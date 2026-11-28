package io.github.jution113.ai_interview_loop;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.client.RestClient;

import static io.github.jution113.ai_interview_loop.MockInterview.Event.*;
import static io.github.jution113.ai_interview_loop.MockInterview.Phase.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "server.address=127.0.0.1")
class InterviewFlowTests {

	@LocalServerPort
	private int port;

	private RestClient client;

	@BeforeEach
	void connect() {
		client = RestClient.create("http://127.0.0.1:" + port + "/api/interviews");
	}

	@Test
	@DisplayName("TC-01: normal transitions and independent evaluation request")
	void completesInterview() {
		MockInterview.State first = start(90);
		assertEquals(PREPARING, first.phase());
		assertTrue(first.remainingMillis() > 9000 && first.remainingMillis() <= 10000);

		MockInterview.State answering = send(first, PREPARATION_EXPIRED);
		assertEquals(ANSWERING, answering.phase());
		assertEquals(90000L, answering.remainingMillis());

		MockInterview.State analyzing = send(answering, ANSWER_EXPIRED);
		assertEquals(ANALYZING, analyzing.phase());
		assertEquals(1, analyzing.acceptedAnswers());

		MockInterview.State second = send(analyzing, ANALYSIS_COMPLETED);
		assertEquals(PREPARING, second.phase());
		assertEquals(10000L, second.remainingMillis());
		assertEquals(2, second.questionNumber());
		assertNotEquals(first.question(), second.question());

		MockInterview.State completed = send(send(answering(second), FINISH_ANSWER), ANALYSIS_COMPLETED);
		assertEquals(COMPLETED, completed.phase());
		assertEquals(2, completed.acceptedAnswers());
		assertEquals(MockInterview.Evaluation.REQUESTED, completed.evaluation());
	}

	@Test
	@DisplayName("TC-02: invalid phase and stale question events cannot change state")
	void ignoresInvalidAndStaleEvents() {
		MockInterview.State first = start(60);
		MockInterview.State ignored = send(first, FINISH_ANSWER);
		assertEquals(PREPARING, ignored.phase());
		assertEquals(first.version(), ignored.version());
		assertEquals(0, ignored.acceptedAnswers());
		MockInterview.State firstAnswer = answering(first);
		MockInterview.State second = send(send(firstAnswer, FINISH_ANSWER), ANALYSIS_COMPLETED);
		MockInterview.State secondAnswer = answering(second);
		MockInterview.State stale = send(firstAnswer, FINISH_ANSWER);

		assertEquals(ANSWERING, stale.phase());
		assertEquals(secondAnswer.version(), stale.version());
		assertEquals(2, stale.questionNumber());
		assertEquals(1, stale.acceptedAnswers());
	}

	@Test
	@DisplayName("TC-03: competing completion and expiration accept exactly one answer")
	void acceptsAnswerOnce() throws Exception {
		MockInterview.State preparing = start(120);
		List<MockInterview.State> started = race(preparing, START_ANSWER, PREPARATION_EXPIRED);
		for (MockInterview.State state : started) {
			assertEquals(ANSWERING, state.phase());
			assertEquals(preparing.version() + 1, state.version());
			assertEquals(0, state.acceptedAnswers());
		}
		MockInterview.State answering = started.getFirst();
		for (MockInterview.State state : race(answering, FINISH_ANSWER, ANSWER_EXPIRED)) {
			assertEquals(ANALYZING, state.phase());
			assertEquals(1, state.acceptedAnswers());
			assertEquals(answering.version() + 1, state.version());
		}
	}

	private List<MockInterview.State> race(MockInterview.State state,
			MockInterview.Event first, MockInterview.Event second) throws Exception {
		CyclicBarrier barrier = new CyclicBarrier(2);
		try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
			Future<MockInterview.State> clicked = executor.submit(() -> {
				barrier.await(5, TimeUnit.SECONDS);
				return send(state, first);
			});
			Future<MockInterview.State> expired = executor.submit(() -> {
				barrier.await(5, TimeUnit.SECONDS);
				return send(state, second);
			});
			return List.of(clicked.get(5, TimeUnit.SECONDS), expired.get(5, TimeUnit.SECONDS));
		}
	}

	@Test
	@DisplayName("TC-04: manual termination and interruption never request evaluation")
	void stopsWithoutEvaluation() {
		for (MockInterview.Event event : new MockInterview.Event[]{END_INTERVIEW, PROCESSING_FAILED}) {
			MockInterview.State analyzing = send(answering(start(60)), FINISH_ANSWER);
			MockInterview.State stopped = send(analyzing, event);
			assertEquals(event == END_INTERVIEW ? ENDED : INTERRUPTED, stopped.phase());
			assertEquals(MockInterview.Evaluation.NOT_REQUESTED, stopped.evaluation());
			assertEquals(stopped, send(analyzing, ANALYSIS_COMPLETED));
		}
	}

	private MockInterview.State start(int seconds) {
		return client.post().body(Map.of("answerSeconds", seconds))
				.retrieve().body(MockInterview.State.class);
	}

	private MockInterview.State answering(MockInterview.State question) {
		return send(question, START_ANSWER);
	}

	private MockInterview.State send(MockInterview.State state, MockInterview.Event event) {
		return client.post().uri("/{id}/events", state.id())
				.body(Map.of("event", event, "version", state.version()))
				.retrieve().body(MockInterview.State.class);
	}
}
