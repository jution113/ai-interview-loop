package io.github.jution113.ai_interview_loop;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/interviews")
class InterviewController {

	private final Map<UUID, MockInterview> interviews = new ConcurrentHashMap<>();

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	MockInterview.State start(@RequestBody StartRequest request) {
		int seconds = request.answerSeconds();
		if (seconds != 60 && seconds != 90 && seconds != 120) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported answer duration");
		}

		var interview = new MockInterview(seconds);
		interviews.put(interview.id(), interview);
		return interview.snapshot(Instant.now());
	}

	@GetMapping("/{id}")
	MockInterview.State current(@PathVariable UUID id) {
		return find(id).snapshot(Instant.now());
	}

	@PostMapping("/{id}/events")
	MockInterview.State advance(@PathVariable UUID id, @RequestBody EventRequest request) {
		if (request.event() == null || request.version() == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event and state version are required");
		}
		return find(id).advance(request.event(), request.version());
	}

	private MockInterview find(UUID id) {
		var interview = interviews.get(id);
		if (interview == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Interview unavailable");
		}
		return interview;
	}

	private record StartRequest(int answerSeconds) {}

	private record EventRequest(MockInterview.Event event, Long version) {}
}
