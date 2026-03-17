import http from 'k6/http';
import { check } from 'k6';

// Spike test - sudden traffic spike
export const options = {
  stages: [
    { duration: '30s', target: 10 },    // Baseline
    { duration: '10s', target: 500 },   // Spike!
    { duration: '1m', target: 500 },    // Stay high
    { duration: '10s', target: 10 },    // Recover
    { duration: '1m', target: 10 },     // Verify recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<1000'],   // 99% under 1s even during spike
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

export default function () {
  // Widget endpoint is critical - test it heavily
  const res = http.get(`${BASE_URL}/widget/demo-project/data`);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });
}
