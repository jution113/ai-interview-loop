package io.github.jution113.ai_interview_loop;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

final class MockInterview {

	private static final List<String> QUESTIONS = List.of(
			"지원 직무에 관심을 갖게 된 계기는 무엇인가요?",
			"협업 중 의견이 달랐을 때 어떻게 조율했나요?"
	);

	private final UUID id = UUID.randomUUID();
	private final int answerSeconds;
	private Phase phase = Phase.PREPARING;
	private Evaluation evaluation = Evaluation.NOT_REQUESTED;
	private int questionIndex;
	private int acceptedAnswers;
	private long version;
	private Instant deadline;

	MockInterview(int answerSeconds) {
		this.answerSeconds = answerSeconds;
		this.deadline = Instant.now().plusSeconds(10);
	}

	UUID id() {
		return id;
	}

	synchronized State advance(Event event, long expectedVersion) {
		Instant now = Instant.now();
		if (version != expectedVersion || phase.isTerminal()) {
			return snapshot(now);
		}

		switch (event) {
			case START_ANSWER, PREPARATION_EXPIRED -> {
				if (phase == Phase.PREPARING) enter(Phase.ANSWERING, now.plusSeconds(answerSeconds));
			}
			case FINISH_ANSWER, ANSWER_EXPIRED -> {
				if (phase == Phase.ANSWERING) {
					acceptedAnswers++;
					enter(Phase.ANALYZING, null);
				}
			}
			case ANALYSIS_COMPLETED -> {
				if (phase == Phase.ANALYZING) completeAnalysis(now);
			}
			case END_INTERVIEW -> enter(Phase.ENDED, null);
			case PROCESSING_FAILED -> enter(Phase.INTERRUPTED, null);
		}
		return snapshot(now);
	}

	private void completeAnalysis(Instant now) {
		if (questionIndex + 1 < QUESTIONS.size()) {
			questionIndex++;
			enter(Phase.PREPARING, now.plusSeconds(10));
			return;
		}
		enter(Phase.COMPLETED, null);
		if (acceptedAnswers > 0) {
			evaluation = Evaluation.REQUESTED;
		}
	}

	private void enter(Phase next, Instant nextDeadline) {
		phase = next;
		deadline = nextDeadline;
		version++;
	}

	synchronized State snapshot(Instant now) {
		Long remainingMillis = deadline == null ? null : Math.max(0, Duration.between(now, deadline).toMillis());
		return new State(id, phase, questionIndex + 1, QUESTIONS.get(questionIndex),
				remainingMillis, version, acceptedAnswers, evaluation);
	}

	enum Phase {
		PREPARING, ANSWERING, ANALYZING, COMPLETED, ENDED, INTERRUPTED;

		boolean isTerminal() {
			return this == COMPLETED || this == ENDED || this == INTERRUPTED;
		}
	}

	enum Event {
		START_ANSWER, PREPARATION_EXPIRED,
		FINISH_ANSWER, ANSWER_EXPIRED, ANALYSIS_COMPLETED, END_INTERVIEW, PROCESSING_FAILED
	}

	enum Evaluation { NOT_REQUESTED, REQUESTED }

	record State(UUID id, Phase phase, int questionNumber, String question,
			Long remainingMillis, long version, int acceptedAnswers, Evaluation evaluation) {}
}
