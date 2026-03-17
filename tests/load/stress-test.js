import http from 'k6/http';
import { check, sleep } from 'k6';

// Stress test - find breaking point
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Normal load
    { duration: '5m', target: 100 },
    { duration: '2m', target: 400 },   // High load
    { duration: '5m', target: 400 },
    { duration: '2m', target: 800 },   // Peak load
    { duration: '5m', target: 800 },
    { duration: '2m', target: 1000 },  // Stress
    { duration: '5m', target: 1000 },
    { duration: '5m', target: 0 },     // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // Allow higher latency under stress
    http_req_failed: ['rate<0.05'],     // Allow up to 5% errors under stress
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

export default function () {
  // Simulate a user journey
  
  // 1. Load widget (most important endpoint)
  const widgetRes = http.get(`${BASE_URL}/widget/demo-project/data`);
  check(widgetRes, {
    'widget status is 200': (r) => r.status === 200,
  });
  sleep(2);

  // 2. Get mentions
  const mentionsRes = http.get(`${BASE_URL}/mentions?projectId=demo-project`);
  check(mentionsRes, {
    'mentions status is 200': (r) => r.status === 200,
  });
  sleep(3);

  // 3. Update mention status (POST request)
  const updateRes = http.patch(
    `${BASE_URL}/mentions/demo-mention`,
    JSON.stringify({ status: 'approved' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(updateRes, {
    'update status is 200': (r) => r.status === 200,
  });
  sleep(5);
}
