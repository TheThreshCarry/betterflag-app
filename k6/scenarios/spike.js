import { cmsList } from "../scripts/cms-content-types.js";
import { entriesList } from "../scripts/cms-entries.js";
import { authLogin } from "../scripts/auth-flow.js";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "10s", target: 200 },
    { duration: "1m", target: 200 },
    { duration: "10s", target: 10 },
    { duration: "1m", target: 10 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.10"],
  },
};

export default function () {
  const choice = Math.random();
  if (choice < 0.4) {
    cmsList();
  } else if (choice < 0.7) {
    entriesList();
  } else {
    authLogin();
  }
}
