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
