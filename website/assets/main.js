document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });
  }
  document.querySelectorAll('.nav-links a').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
});