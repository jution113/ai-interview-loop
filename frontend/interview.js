const labels = {
  PREPARING: '준비',
  ANSWERING: '답변',
  ANALYZING: '분석',
  COMPLETED: '면접을 완료했습니다.',
  ENDED: '면접을 직접 종료했습니다.',
  INTERRUPTED: '오류로 면접이 중단되었습니다.',
};

const nextActions = {
  PREPARING: ['바로 답변', 'START_ANSWER'],
  ANSWERING: ['답변 완료', 'FINISH_ANSWER'],
};

const params = new URLSearchParams(location.search);
const api = '/api/interviews';
const phase = document.querySelector('#phase');
const questionPanel = document.querySelector('#question-panel');
const questionNumber = document.querySelector('#question-number');
const question = document.querySelector('#question');
const timer = document.querySelector('#timer');
const capture = document.querySelector('#capture');
const evaluation = document.querySelector('#evaluation');
const requestError = document.querySelector('#request-error');
const answerAction = document.querySelector('#answer-action');
const end = document.querySelector('#end');
const retry = document.querySelector('#retry');

let id = params.get('id');
let state;
let interval;
let pending = false;

async function request(path, body) {
  const response = await fetch(path, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(response.status === 404
      ? '이 면접을 찾을 수 없습니다. 설정 화면에서 새로 시작하세요.'
      : '면접 상태를 확인하지 못했습니다. 다시 확인해 주세요.');
  }
  return response.json();
}

function render(current) {
  state = current;
  clearInterval(interval);

  const action = nextActions[state.phase];
  phase.textContent = labels[state.phase];
  const preparing = state.phase === 'PREPARING';
  const answering = state.phase === 'ANSWERING';
  answerAction.hidden = !preparing && !answering;
  if (!answerAction.hidden) answerAction.textContent = action[0];
  questionPanel.hidden = !action;
  questionNumber.textContent = `${state.questionNumber}번 질문`;
  question.textContent = state.question;
  capture.hidden = state.phase !== 'ANSWERING';
  evaluation.hidden = state.evaluation !== 'REQUESTED';
  end.hidden = questionPanel.hidden;

  timer.hidden = state.remainingMillis === null;
  if (!timer.hidden) {
    const deadline = performance.now() + state.remainingMillis;
    const expiration = state.phase === 'PREPARING' ? 'PREPARATION_EXPIRED' : 'ANSWER_EXPIRED';
    const tick = () => {
      const remaining = Math.max(0, deadline - performance.now());
      const seconds = Math.ceil(remaining / 1000);
      const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
      timer.textContent = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
      timer.dataset.warning = preparing && seconds >= 1 && seconds <= 3 ? String(seconds) : '';
      if (remaining === 0 && !pending) {
        clearInterval(interval);
        void send(expiration);
      }
    };
    tick();
    interval = setInterval(tick, 100);
  }
}

async function update(load) {
  if (pending) return;
  pending = true;
  answerAction.disabled = end.disabled = retry.disabled = true;
  requestError.hidden = retry.hidden = true;
  try {
    render(await load());
    if (state.phase === 'ANALYZING') {
      render(await postEvent('ANALYSIS_COMPLETED'));
    }
  } catch (error) {
    clearInterval(interval);
    requestError.textContent = error.message;
    requestError.hidden = retry.hidden = false;
  } finally {
    pending = false;
    retry.disabled = false;
    end.disabled = !requestError.hidden;
    answerAction.disabled = !requestError.hidden;
  }
}

function sync() {
  return update(async () => {
    if (id) return request(`${api}/${encodeURIComponent(id)}`);
    const started = await request(api, { answerSeconds: Number(params.get('seconds')) });
    id = started.id;
    history.replaceState(null, '', `/interview.html?id=${id}`);
    return started;
  });
}

function postEvent(event) {
  return request(`${api}/${encodeURIComponent(id)}/events`, { event, version: state.version });
}

function send(event) {
  return update(() => postEvent(event));
}

answerAction.addEventListener('click', () => void send(nextActions[state.phase][1]));
end.addEventListener('click', () => void send('END_INTERVIEW'));
retry.addEventListener('click', () => void sync());
void sync();
