const form = document.getElementById('changePwForm');
const current = document.getElementById('current');
const newpw = document.getElementById('newpw');
const confirmPw = document.getElementById('confirm');
const feedback = document.getElementById('pwFeedback');
const submitBtn = document.getElementById('submitPw');
const cancelBtn = document.getElementById('cancelPw');

function setFeedback(msg, type) {
  feedback.textContent = msg;
  feedback.style.color = type === 'error' ? '#ffcccc' : type === 'success' ? '#ccffcc' : 'white';
}

cancelBtn.addEventListener('click', () => {
  current.value = '';
  newpw.value = '';
  confirmPw.value = '';
  setFeedback('', '');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setFeedback('', '');

  if (!current.value.trim() || !newpw.value.trim() || !confirmPw.value.trim()) {
    setFeedback('Fill in all fields.', 'error');
    return;
  }

  if (newpw.value.length < 8) {
    setFeedback('New password must be at least 8 characters.', 'error');
    return;
  }

  if (newpw.value !== confirmPw.value) {
    setFeedback('New password and confirmation do not match.', 'error');
    return;
  }

  submitBtn.disabled = true;
  setFeedback('Updating password...', '');

  await new Promise(r => setTimeout(r, 900));

  setFeedback('✅ Updated! Your password has been changed (demo).', 'success');

  setTimeout(() => {
    current.value = '';
    newpw.value = '';
    confirmPw.value = '';
    submitBtn.disabled = false;
  }, 900);
});
