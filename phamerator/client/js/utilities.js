waitForEl = function (selector, callback) {
  if (jQuery(selector).length) {
    callback();
  } else {
    setTimeout(function () {
      waitForEl(selector, callback);
    }, 100);
  }
};

window.showToast = function(options) {
  const message = options.html || 'Notification';
  const classes = options.classes || '';
  
  let bgClass = 'bg-dark text-white';
  if (classes.includes('red')) bgClass = 'bg-danger text-white';
  if (classes.includes('green')) bgClass = 'bg-success text-white';

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '1090';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center border-0 ${bgClass}`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  
  const displayLength = options.displayLength || 4000;
  toastEl.setAttribute('data-bs-delay', displayLength);

  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(toastEl);
  
  if (typeof bootstrap !== 'undefined') {
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
    
    toastEl.addEventListener('hidden.bs.toast', () => {
      toastEl.remove();
    });
  }
};

window.M = window.M || {};
window.M.toast = window.showToast;

// Global mouse-following tooltip for elements with [data-tip]
Meteor.startup(function () {
  let tooltipEl = null;

  function getTooltipEl() {
    if (!tooltipEl || !document.body.contains(tooltipEl)) {
      tooltipEl = document.getElementById('css-tooltip-el');
      if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'css-tooltip-el';
        document.body.appendChild(tooltipEl);
      }
    }
    return tooltipEl;
  }

  document.addEventListener('mouseover', function (e) {
    const target = e.target.closest && e.target.closest('[data-tip]');
    if (target) {
      const tipText = target.getAttribute('data-tip');
      if (tipText) {
        const el = getTooltipEl();
        el.textContent = tipText;
        el.style.display = 'block';
      }
    }
  });

  document.addEventListener('mousemove', function (e) {
    const el = document.getElementById('css-tooltip-el');
    if (el && el.style.display === 'block') {
      const tooltipWidth = el.offsetWidth || 200;
      const tooltipHeight = el.offsetHeight || 40;
      let x = e.clientX + 15;
      let y = e.clientY - (tooltipHeight / 2);

      // Boundary checks to stay within viewport
      if (x + tooltipWidth > window.innerWidth - 10) {
        x = e.clientX - tooltipWidth - 15;
      }
      if (x < 10) {
        x = 10;
      }
      if (y + tooltipHeight > window.innerHeight - 10) {
        y = window.innerHeight - tooltipHeight - 10;
      }
      if (y < 10) {
        y = 10;
      }

      el.style.left = x + 'px';
      el.style.top = y + 'px';
    }
  });

  document.addEventListener('mouseout', function (e) {
    const target = e.target.closest && e.target.closest('[data-tip]');
    if (target) {
      if (e.relatedTarget && target.contains(e.relatedTarget)) {
        return;
      }
      const el = document.getElementById('css-tooltip-el');
      if (el) {
        el.style.display = 'none';
      }
    }
  });

  window.addEventListener('scroll', function () {
    const el = document.getElementById('css-tooltip-el');
    if (el && el.style.display === 'block') {
      el.style.display = 'none';
    }
  }, { passive: true });
});
