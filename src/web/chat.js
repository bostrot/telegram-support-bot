// on window load
window.addEventListener('load', function() {
  const frame = document.createElement('iframe');
  frame.style = 'width: 580px; height: 400px; border: none;' +
    'position: absolute; bottom: 0; right: 0;';
  frame.scroll = 'no';
  frame.src = 'http://localhost:8080';
  document.body.appendChild(frame);
});
