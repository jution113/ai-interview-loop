package io.github.jution113.ai_interview_loop;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "server.address=127.0.0.1")
class InterviewSetupPageTests {

	@LocalServerPort
	private int port;

	@Test
	@DisplayName("TC-01: Spring Boot serves the setup page and its static assets")
	void servesSetupPageAndAssets() throws Exception {
		try (HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()) {
			HttpResponse<String> page = get(client, "/");
			assertEquals(200, page.statusCode());
			assertTrue(page.body().contains("면접 설정"));
			assertTrue(page.body().contains("href=\"/setup.css\""));
			assertTrue(page.body().contains("src=\"/setup.js\""));

			assertAsset(client, "/setup.css", "text/css");
			assertAsset(client, "/setup.js", "javascript");
		}
	}

	private void assertAsset(HttpClient client, String path, String mediaType) throws Exception {
		HttpResponse<String> response = get(client, path);
		assertEquals(200, response.statusCode());
		assertTrue(response.headers().firstValue("Content-Type").orElse("").contains(mediaType));
		assertTrue(!response.body().isBlank());
		assertTrue(response.headers().firstValue("Cache-Control").orElse("").contains("no-cache"));
	}

	private HttpResponse<String> get(HttpClient client, String path) throws Exception {
		HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
				.timeout(Duration.ofSeconds(5))
				.build();
		return client.send(request, HttpResponse.BodyHandlers.ofString());
	}
}
