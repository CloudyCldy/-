$path = 'c:\Users\claus\haitani\public\js\app.js'
$content = [System.IO.File]::ReadAllText($path)
$start = $content.IndexOf('async function messagesView(selectedId){')
$end = $content.IndexOf('async function gantt(){')
$replacement = @'
async function messagesView(selectedId){
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const selectedGroupId=params.get('group');
  const users=(await api('/users')).filter(user=>user.active&&user.id!==state.user.id);
  const groups=(await api('/messages/groups').catch(()=>[]));
  const directPreviews=await Promise.all(users.map(async user=>{
    const thread=await api(`/messages?user_id=${user.id}`).catch(()=>[]);
    const last=thread[thread.length-1];
    return {user,last};
  }));
  const selected=users.find(user=>String(user.id)===String(selectedId))||users[0]||null;
  const selectedGroup=groups.find(group=>String(group.id)===String(selectedGroupId))||groups[0]||null;
  const selectedGroupDetail=selectedGroup?await api(`/messages/groups/${selectedGroup.id}`).catch(()=>({group:selectedGroup,members:[],messages:[]})):null;
  const messages=selectedGroupDetail?selectedGroupDetail.messages:(selected?await api(`/messages?user_id=${selected.id}`):[]);
  const conversationKey=selected?`${Math.min(state.user.id,selected.id)}-${Math.max(state.user.id,selected.id)}`:`group-${selectedGroup?.id||'0'}`;
  const bgKind=selected?chatBackgroundKind(conversationKey):'gradient';
  const swatches=[['gradient','Aurora'],['solid','Profundo'],['lavender','Lavanda'],['warm','Cálido']];
  const directList=directPreviews.map(({user,last})=>`<button class="conversation-user ${selected&&user.id===selected.id?'active':''}" data-id="${user.id}">${avatarMarkup(user,'message-avatar')}<span class="conversation-user-body"><span class="conversation-user-top"><strong>${esc(user.name)}</strong>${last?`<time>${timeShort(last.created_at)}</time>`:''}</span><small>${last?`${last.sender_id===state.user.id?'Tú: ':''}${esc(last.content||'Documento adjunto').slice(0,42)}${(last.content||'Documento adjunto').length>42?'…':''}`:`@${esc(user.username)}`}</small></span></button>`).join('')||'<div class="empty">No hay otros usuarios activos.</div>';
  const groupList=(groups.length?groups.map(group=>`<button class="conversation-user conversation-group ${selectedGroup&&group.id===selectedGroup.id?'active':''}" data-group-id="${group.id}"><span class="message-avatar group-avatar">G</span><span class="conversation-user-body"><span class="conversation-user-top"><strong>${esc(group.name)}</strong>${group.created_at?`<time>${timeShort(group.created_at)}</time>`:''}</span><small>${group.members_count||0} miembros</small></span></button>`).join(''):'<div class="empty">No hay grupos creados.</div>');
  const conversationHeader=selectedGroupDetail?`<div class="conversation-who"><span class="message-avatar group-avatar">G</span><div><h2>${esc(selectedGroupDetail.group.name)}</h2><small class="muted">${selectedGroupDetail.members.length} miembros</small></div></div><div class="conversation-tools"><div class="bg-swatches" role="group" aria-label="Fondo de la conversación">${swatches.map(([value,label])=>`<button type="button" class="bg-swatch bg-${value} ${bgKind===value?'active':''}" data-bg="${value}" title="${label}"></button>`).join('')}<label class="bg-swatch bg-upload-label" title="Subir foto de fondo"><input class="chat-bg-upload" type="file" accept="image/png,image/jpeg,image/webp" data-key="${conversationKey}" hidden>+</label></div><div class="icon-group conversation-actions"><button class="icon-btn" id="refresh-group" title="Actualizar" aria-label="Actualizar">↻</button></div></div>`:selected?`<div class="conversation-who">${avatarMarkup(selected,'message-avatar')}<div><h2>${esc(selected.name)}</h2><small class="muted">@${esc(selected.username)}</small></div></div><div class="conversation-tools"><div class="bg-swatches" role="group" aria-label="Fondo de la conversación">${swatches.map(([value,label])=>`<button type="button" class="bg-swatch bg-${value} ${bgKind===value?'active':''}" data-bg="${value}" title="${label}"></button>`).join('')}<label class="bg-swatch bg-upload-label" title="Subir foto de fondo"><input class="chat-bg-upload" type="file" accept="image/png,image/jpeg,image/webp" data-key="${conversationKey}" hidden>+</label></div><div class="icon-group conversation-calls"><button class="icon-btn call-user" data-id="${selected.id}" data-video="false" title="Llamar" aria-label="Llamar">☎</button><button class="icon-btn call-user" data-id="${selected.id}" data-video="true" title="Videollamada" aria-label="Videollamada">▣</button></div></div>`:'<h2>Selecciona una conversación</h2>';
  const messageMarkup=messagesForList(messages).map(item=>item.divider?`<div class="day-divider"><span>${esc(item.divider)}</span></div>`:(message=>`<article class="message ${message.sender_id===state.user.id?'mine':''}">${message.sender_id===state.user.id?'':avatarMarkup({name:message.sender_name,profile_photo:message.sender_photo},'message-avatar')}<div class="bubble">${message.content?`<p>${esc(message.content)}</p>`:''}${message.attachment_id&&message.attachment_name?`<div class="chat-attachment"><div class="chat-attachment-file"><span class="chat-attachment-icon">${(message.attachment_mime||'').startsWith('image/')?'IMG':(message.attachment_mime||'').includes('pdf')?'PDF':'DOC'}</span><strong>${esc(message.attachment_name)}</strong></div><div class="chat-attachment-actions"><a class="btn secondary" href="/api/files/${message.attachment_id}/view" target="_blank" rel="noopener">Ver</a><a class="btn secondary" href="/api/files/${message.attachment_id}/download" target="_blank" rel="noopener">Descargar</a></div></div>`:''}<small>${timeShort(message.created_at)}${message.sender_id===state.user.id?` · ${message.delivery_status==='leido'?'✓✓ leído':message.delivery_status==='entregado'?'✓✓ entregado':'✓ enviado'}`:''}</small></div></article>`)(item.message)).join('')||'<div class="empty">No hay mensajes todavía.</div>';
  return `${heading('Mensajes',selectedGroupDetail?'Conversaciones de grupo con el equipo.':'Conversaciones directas con las personas del equipo.')}<section class="messages-layout"><aside class="card conversation-list"><div class="conversation-section-head"><strong>Directos</strong><button class="btn secondary mini" id="new-group" type="button">+ Grupo</button></div>${directList}<div class="conversation-section-head"><strong>Grupos</strong></div>${groupList}</aside><section class="card conversation"><div class="conversation-header">${conversationHeader}</div><div class="message-list" data-bg-key="${conversationKey}" style="background:${chatBackground(conversationKey)}">${messageMarkup}</div>${(selectedGroupDetail||selected)?`<form id="message-form" class="message-form" data-group-id="${selectedGroupDetail?selectedGroupDetail.group.id:''}"><textarea class="textarea" name="content" rows="1" placeholder="${selectedGroupDetail?'Escribe un mensaje al grupo...':'Escribe un mensaje...'}" required></textarea><label class="chat-file-picker" title="Adjuntar documento"><input type="file" name="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,image/pdf,image/png,image/jpeg,image/webp"><span>📎</span></label><button class="btn send-btn" title="Enviar" aria-label="Enviar">➤</button></form>`:''}</section></section><div id="call-modal" class="call-modal" hidden><div class="call-panel"><div class="call-head"><strong>Llamada</strong><button class="btn danger" id="hangup">Colgar</button></div><video id="call-remote" autoplay playsinline></video><video id="call-local" autoplay muted playsinline></video></div></div>`;
}
async function renderMessages(){
  signalSocket();
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const selectedId=params.get('user');
  layout(await messagesView(selectedId));
  const list=document.querySelector('.message-list');
  if(list)list.scrollTop=list.scrollHeight;
  document.querySelectorAll('.conversation-user').forEach(button=>button.onclick=()=>{
    const query=new URLSearchParams(location.hash.split('?')[1]||'');
    if(button.dataset.groupId){
      query.set('group',button.dataset.groupId);
      query.delete('user');
    }else{
      query.delete('group');
      query.set('user',button.dataset.id);
    }
    location.hash=`#/${state.user.role}/messages?${query.toString()}`;
    renderMessages();
  });
  document.querySelectorAll('.call-user').forEach(button=>button.onclick=()=>startCall(button.dataset.id,button.dataset.video==='true'));
  document.querySelector('#hangup')?.addEventListener('click',endCall);
  document.querySelector('#new-group')?.addEventListener('click',async()=>{
    const name=prompt('Nombre del grupo');
    if(!name||!name.trim())return;
    try{
      await api('/messages/groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),members:[]})});
      const query=new URLSearchParams(location.hash.split('?')[1]||'');
      query.delete('user');
      location.hash=`#/${state.user.role}/messages?${query.toString()}`;
      renderMessages();
    }catch(error){notify(error.message)}
  });
  const swatchGroup=document.querySelector('.bg-swatches');
  const upload=document.querySelector('.chat-bg-upload');
  if(swatchGroup){
    const key=list?.dataset.bgKey;
    document.querySelectorAll('.bg-swatch[data-bg]').forEach(swatch=>swatch.onclick=()=>{
      const backgrounds={gradient:'linear-gradient(135deg,#13202B,#2A3541)',solid:'#2A3541',lavender:'linear-gradient(135deg,#767E99,#C4B5C8)',warm:'linear-gradient(135deg,#201B19,#13202B)'};
      localStorage.setItem(`haitani-chat-bg-${key}`,backgrounds[swatch.dataset.bg]);
      renderMessages();
    })
  }
  upload?.addEventListener('change',async()=>{
    if(!upload.files[0])return;
    try{
      const form=new FormData();
      form.append('background',upload.files[0]);
      const result=await api('/chat-backgrounds',{method:'POST',body:form});
      localStorage.setItem(`haitani-chat-bg-${upload.dataset.key}`,`url(${result.url}) center/cover no-repeat`);
      renderMessages();
    }catch(error){notify(error.message)}
  });
  const textarea=document.querySelector('#message-form textarea');
  if(textarea){
    textarea.addEventListener('input',()=>{
      textarea.style.height='auto';
      textarea.style.height=`${Math.min(textarea.scrollHeight,140)}px`;
    });
    textarea.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.querySelector('#message-form').requestSubmit()}})
  }
  document.querySelector('#message-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.target;
    const formData=new FormData(form);
    const content=String(formData.get('content')||'').trim();
    if(!content && !(formData.get('file')&&formData.get('file').size))return;
    const groupId=form.dataset.groupId;
    if(groupId){
      formData.append('content',content);
    } else {
      formData.append('user_id',selectedId||'');
      formData.append('content',content);
    }
    try{
      await api(groupId?`/messages/groups/${groupId}/messages`:'/messages',{method:'POST',body:formData});
      renderMessages();
    }catch(error){notify(error.message)}
  });
}
'@

$content = $content.Substring(0,$start) + $replacement + $content.Substring($end)
[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
