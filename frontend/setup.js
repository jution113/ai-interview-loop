const form = document.querySelector('#setup');
const application = document.querySelector('#application');
const research = document.querySelector('#research');
const researchFiles = document.querySelector('#research-files');
const confirmed = document.querySelector('#confirmed');
const duration = document.querySelector('#duration');
const result = document.querySelector('#result');
const requiredFiles = [application, research];

let submitted = false;

function showError(field, invalid) {
  const error = document.getElementById(`${field.id}-error`);
  error.hidden = !invalid;
  if (invalid) {
    field.setAttribute('aria-invalid', 'true');
  } else {
    field.removeAttribute('aria-invalid');
  }
}

function validateSetup() {
  const missing = requiredFiles.filter(field => field.files.length === 0);
  for (const field of requiredFiles) {
    showError(field, missing.includes(field));
  }
  const needsConfirmation = missing.length === 0 && !confirmed.checked;
  showError(confirmed, needsConfirmation);
  return missing[0] ?? (needsConfirmation ? confirmed : null);
}

for (const field of requiredFiles) {
  const clear = document.getElementById(`${field.id}-clear`);
  clear.addEventListener('click', () => {
    field.value = '';
    field.dispatchEvent(new Event('change'));
    field.focus();
  });
  field.addEventListener('change', () => {
    clear.hidden = field.files.length === 0;
    confirmed.checked = false;
    confirmed.disabled = requiredFiles.some(input => input.files.length === 0);
    result.textContent = '';
    if (submitted) validateSetup();
  });
}

research.addEventListener('change', () => {
  researchFiles.replaceChildren(...Array.from(research.files, file => {
    const item = document.createElement('li');
    item.textContent = file.name;
    return item;
  }));
});

confirmed.addEventListener('change', () => {
  result.textContent = '';
  if (submitted) validateSetup();
});

duration.addEventListener('change', () => { result.textContent = ''; });

form.addEventListener('submit', event => {
  event.preventDefault();
  submitted = true;
  const invalidField = validateSetup();
  if (invalidField) {
    result.textContent = '';
    invalidField.focus();
    return;
  }
  result.textContent = `모의 설정을 확인했습니다. 답변 제한 시간은 ${duration.value}초입니다.`;
});

document.querySelector('#submit').disabled = false;
