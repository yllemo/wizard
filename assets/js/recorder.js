let mediaRecorder, recordedChunks=[];
async function startRecording(){ 
  const s=await navigator.mediaDevices.getUserMedia({audio:true}); 
  
  // Configure MediaRecorder with best supported options
  let options = {};
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    options.mimeType = 'audio/webm;codecs=opus';
  } else if (MediaRecorder.isTypeSupported('audio/webm')) {
    options.mimeType = 'audio/webm';
  }
  
  mediaRecorder=new MediaRecorder(s, options); 
  recordedChunks=[]; 
  mediaRecorder.ondataavailable=e=>{ if(e.data.size>0) recordedChunks.push(e.data); }; 
  mediaRecorder.onstop=async ()=>{ 
    // Determine the best MIME type based on browser support
    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    }
    
    const blob=new Blob(recordedChunks,{type: mimeType}); 
    const file=new File([blob],'recording.webm',{type: mimeType}); 
    const fd=new FormData(); 
    fd.append('action','upload'); 
    
    // Get meetingId from state or DOM
    const meetingId = window.state?.meetingId || document.getElementById('meetingId')?.textContent;
    if (!meetingId) {
      console.error('No meetingId found');
      toast('Fel: Inget möte valt', 'error');
      return;
    }
    
    fd.append('meetingId', meetingId); 
    fd.append('audio', file);
    
    console.log('Recording - meetingId:', meetingId); 
    
    console.log('Uploading audio file:', file.name, 'MIME type:', mimeType, 'Size:', file.size);
    
    const r=await fetch('index.php',{method:'POST', body:fd}); 
    const j=await r.json(); 
    if(j.ok){ 
      window.state = window.state || {}; 
      window.state.uploaded=j; 
      console.log('Upload successful:', j);
      toast('Uppladdad'); 
      
      // Reload audio files list if function exists
      if (typeof window.loadAudioFiles === 'function') {
        window.loadAudioFiles();
      }
    } else { 
      console.error('Upload failed:', j);
      toast(j.error||'Uppladdning misslyckades', 'error'); 
    } 
  }; 
  mediaRecorder.start(); 
  document.getElementById('recStatus').textContent='Spelar in...'; 
  
  // Set red recording favicon
  const recordingFavicon = document.createElement('link');
  recordingFavicon.rel = 'icon';
  recordingFavicon.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/><text y=".6em" x=".5em" font-size="50" fill="white">●</text></svg>';
  document.head.appendChild(recordingFavicon);
}
function stopRecording(){ 
  if(mediaRecorder && mediaRecorder.state!=='inactive'){ 
    mediaRecorder.stop(); 
    document.getElementById('recStatus').textContent='Stoppad'; 
    
    // Remove all recording favicons (multiple might exist)
    const recordingFavicons = document.querySelectorAll('link[rel="icon"]');
    recordingFavicons.forEach(favicon => {
      if (favicon.href.includes('red') || favicon.href.includes('circle')) {
        favicon.remove();
      }
    });
    
    // Reset to default favicon
    const defaultFavicon = document.createElement('link');
    defaultFavicon.rel = 'icon';
    defaultFavicon.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎤</text></svg>';
    document.head.appendChild(defaultFavicon);
  } 
}

// Download audio file function
async function downloadAudio() {
  if (!window.state || !window.state.meetingId) {
    toast('Inget möte aktivt', 'error');
    return;
  }
  
  try {
    const meetingId = window.state.meetingId;
    const url = `index.php?action=download_audio&meetingId=${encodeURIComponent(meetingId)}`;
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = ''; // Let server set filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast('Ljudfil laddas ner...', 'success');
  } catch (error) {
    toast('Fel vid nedladdning av ljudfil', 'error');
    console.error('Download error:', error);
  }
}

document.addEventListener('DOMContentLoaded',()=>{ 
  document.getElementById('btnStartRec').onclick=startRecording; 
  document.getElementById('btnStopRec').onclick=stopRecording;
  
  // Add download button functionality
  const downloadAudioBtn = document.getElementById('downloadAudioBtn');
  if (downloadAudioBtn) {
    downloadAudioBtn.onclick = downloadAudio;
  }
});
