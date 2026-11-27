const form = document.querySelector('#setup');
const application = document.querySelector('#application');
const research = document.querySelector('#research');
const researchFiles = document.querySelector('#research-files');
const portfolio = document.querySelector('#portfolio');
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
  return missing[0];
}

for (const field of [...requiredFiles, portfolio]) {
  const clear = document.getElementById(`${field.id}-clear`);
  clear.addEventListener('click', () => {
    field.value = '';
    field.dispatchEvent(new Event('change'));
    field.focus();
  });
  field.addEventListener('change', () => {
    clear.hidden = field.files.length === 0;
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

form.addEventListener('submit', event => {
  submitted = true;
  const invalidField = validateSetup();
  if (invalidField) {
    event.preventDefault();
    invalidField.focus();
  }
});

form.noValidate = true;
