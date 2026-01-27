package com.lyra.intel.client;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Client for communicating with Lyra Intel API.
 */
public class LyraIntelClient {
    private final String apiUrl;
    private final String apiKey;
    private final Gson gson;
    private final CloseableHttpClient httpClient;

    public LyraIntelClient(String apiUrl, String apiKey) {
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.gson = new Gson();
        this.httpClient = HttpClients.createDefault();
    }

    /**
     * Analyze a file with Lyra Intel.
     */
    public AnalysisResult analyzeFile(String content, String language) throws IOException {
        Map<String, String> request = new HashMap<>();
        request.put("content", content);
        request.put("language", language);

        String response = post("/analyze/file", request);
        return gson.fromJson(response, AnalysisResult.class);
    }

    /**
     * Run security scan on code.
     */
    public SecurityScanResult securityScan(String content, String language) throws IOException {
        Map<String, String> request = new HashMap<>();
        request.put("content", content);
        request.put("language", language);

        String response = post("/security/scan", request);
        return gson.fromJson(response, SecurityScanResult.class);
    }

    /**
     * Get analysis by ID.
     */
    public AnalysisResult getAnalysis(String analysisId) throws IOException {
        String response = get("/analysis/" + analysisId);
        return gson.fromJson(response, AnalysisResult.class);
    }

    private String post(String endpoint, Object body) throws IOException {
        HttpPost request = new HttpPost(apiUrl + endpoint);
        request.setHeader("Content-Type", "application/json");
        request.setHeader("Authorization", "Bearer " + apiKey);

        String jsonBody = gson.toJson(body);
        request.setEntity(new StringEntity(jsonBody));

        try (CloseableHttpResponse response = httpClient.execute(request)) {
            return EntityUtils.toString(response.getEntity());
        }
    }

    private String get(String endpoint) throws IOException {
        HttpPost request = new HttpPost(apiUrl + endpoint);
        request.setHeader("Authorization", "Bearer " + apiKey);

        try (CloseableHttpResponse response = httpClient.execute(request)) {
            return EntityUtils.toString(response.getEntity());
        }
    }

    public void close() throws IOException {
        httpClient.close();
    }
}
