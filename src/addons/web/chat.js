// on window load
window.addEventListener('load', function() {
  const frame = document.createElement('iframe');
  frame.style = 'width: 580px; height: 400px; border: none;' +
    'position: fixed; bottom: 0; right: 0;';
  frame.scroll = 'no';
  frame.src = document.getElementById('chatScript').src.replace('/chat.js', '');
  document.body.appendChild(frame);
});
