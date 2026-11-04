/* Young Dev / SimCraft field archive.
   Lightweight, local-only interactions. No libraries, analytics, or hardware access. */
(() => {
  'use strict';
  document.documentElement.classList.add('sc-js');

  // Scroll reading indicator. One paint per animation frame at most.
  const progress = document.querySelector('#sc-reading-progress');
  let queued = false;
  function updateProgress() {
    if (!progress) return;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    progress.style.width = `${Math.round(ratio * 1000) / 10}%`;
    queued = false;
  }
  if (progress) {
    updateProgress();
    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(updateProgress);
    }, { passive: true });
    window.addEventListener('resize', updateProgress);
  }

  // Reveal content only if it reaches the viewport. Never hide on older browsers.
  const reveals = [...document.querySelectorAll('.sc-reveal')];
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('sc-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: .07, rootMargin: '0px 0px 20px 0px' });
    reveals.forEach(element => observer.observe(element));
  } else {
    reveals.forEach(element => element.classList.add('sc-visible'));
  }

  // The console is a historical reconstruction, not an electronics controller.
  const stages = [
    { code:'ERR_00', title:'No response.', copy:'The computer is silent. The power supply is only a suspect; first, trace the start signal.', log:'CHECK: START SWITCH PATH', status:'CASE OPEN' },
    { code:'JFP1_01', title:'The missing handshake.', copy:'A loose POWER SW connector is found near the MSI JFP1 front-panel header. This tiny lead may explain the silence.', log:'CLUE: TWO-POSITION SWITCH CONNECTOR', status:'CLUE IDENTIFIED' },
    { code:'BOOT_02', title:'Power returns.', copy:'The switch path is restored. The PC starts, turning a dead machine into a machine full of solvable configuration problems.', log:'MILESTONE: COMPUTER ONLINE', status:'BOOT RECOVERED' },
    { code:'FOV_03', title:'Three become one.', copy:'Windows orders the displays 1–2–3. In iRacing, three-screen projection joins the separate images into a continuous racetrack.', log:'MILESTONE: PANORAMIC VIEW ONLINE', status:'DISPLAYS ALIGNED' },
    { code:'MOT_04', title:'The chassis remembers motion.', copy:'The SimCraft platform is identified and functioning; the Simucube wheelbase and Fanatec pedal inputs are recognized.', log:'MILESTONE: DRIVING SYSTEMS ACTIVE', status:'MOTION WORKING' },
    { code:'AUD_05', title:'One last unfinished song.', copy:'A Pyle amplifier (apparently PTA66BT) and loose speaker wires wait for their connections to be traced. The revival continues.', log:'OPEN ITEM: VERIFY AUDIO WIRING', status:'AUDIO PENDING' }
  ];
  const buttons = [...document.querySelectorAll('#sc-signal-array button[data-stage]')];
  const prev = document.getElementById('sc-prev');
  const next = document.getElementById('sc-next');
  const count = document.getElementById('sc-console-count');
  const code = document.getElementById('sc-screen-code');
  const title = document.getElementById('sc-screen-title');
  const copy = document.getElementById('sc-screen-copy');
  const log = document.getElementById('sc-screen-log');
  const status = document.getElementById('sc-console-status');
  if (buttons.length === stages.length && prev && next && title && copy && log && status && count && code) {
    let current = 0;
    function showStage(index) {
      current = Math.max(0, Math.min(stages.length - 1, index));
      const stage = stages[current];
      count.textContent = `${String(current+1).padStart(2,'0')} / ${String(stages.length).padStart(2,'0')}`;
      code.textContent = stage.code;
      title.textContent = stage.title;
      copy.textContent = stage.copy;
      log.textContent = stage.log;
      status.textContent = stage.status;
      prev.disabled = current === 0;
      next.textContent = current === stages.length - 1 ? 'Replay ↺' : 'Next signal →';
      buttons.forEach((button, index) => {
        if (index === current) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
    }
    buttons.forEach((button,index) => button.addEventListener('click', () => showStage(index)));
    prev.addEventListener('click', () => showStage(current - 1));
    next.addEventListener('click', () => showStage(current === stages.length - 1 ? 0 : current + 1));
    showStage(0);
  }

  // The images remain ordinary links if <dialog> is unavailable.
  const dialog = document.getElementById('sc-lightbox');
  const bigImage = document.getElementById('sc-lightbox-img');
  const caption = document.getElementById('sc-lightbox-caption');
  if (dialog && bigImage && caption && typeof dialog.showModal === 'function') {
    const links = document.querySelectorAll('a[data-lightbox]');
    links.forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      const thumbnail = link.querySelector('img');
      bigImage.src = link.getAttribute('href');
      bigImage.alt = thumbnail?.alt || 'Enlarged workshop photo';
      caption.textContent = link.dataset.caption || '';
      dialog.showModal();
    }));
    dialog.addEventListener('click', event => {
      // Close only when clicking the shaded space outside the dialog content.
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      bigImage.removeAttribute('src');
    });
  }
})();
