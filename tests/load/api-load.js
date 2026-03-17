import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },    // Ramp up to 100 users
    { duration: '5m', target: 100 },    // Stay at 100 users
    { duration: '2m', target: 200 },    // Ramp up to 200 users
    { duration: '5m', target: 200 },    // Stay at 200 users
    { duration: '2m', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],    // 95% of requests < 200ms
    http_req_failed: ['rate<0.01'],      // Error rate < 1%
    errors: ['rate<0.05'],               // Custom error rate < 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

// Helper function to check response
function checkResponse(response, expectedStatus = 200) {
  const success = check(response, {
    [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  
  return success;
}

export default function () {
  group('Widget API', () => {
    // Test widget data endpoint
    const widgetRes = http.get(`${BASE_URL}/widget/demo-project/data`);
    checkResponse(widgetRes);
    sleep(1);

    // Test widget script endpoint
    const scriptRes = http.get(`${BASE_URL}/widget/demo-project/script.js`);
    checkResponse(scriptRes);
    sleep(1);
  });

  group('Projects API', () => {
    // Get projects list
    const projectsRes = http.get(`${BASE_URL}/projects`);
    checkResponse(projectsRes);
    sleep(1);

    // Get single project
    const projectRes = http.get(`${BASE_URL}/projects/demo-project`);
    checkResponse(projectRes, 200);
    sleep(1);
  });

  group('Mentions API', () => {
    // Get mentions
    const mentionsRes = http.get(`${BASE_URL}/mentions?projectId=demo-project&status=approved`);
    checkResponse(mentionsRes);
    sleep(1);
  });

  group('Sources API', () => {
    // Get sources
    const sourcesRes = http.get(`${BASE_URL}/sources?projectId=demo-project`);
    checkResponse(sourcesRes);
    sleep(1);
  });
}

// Setup function
export function setup() {
  console.log(`Starting load test against: ${BASE_URL}`);
  return {};
}

// Teardown function
export function teardown(data) {
  console.log('Load test completed');
}
