import { cmsList } from "../scripts/cms-content-types.js";
import { entriesList } from "../scripts/cms-entries.js";
import { syncUpsert } from "../scripts/sync-api.js";

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "2m", target: 100 },
    { duration: "2m", target: 200 },
    { duration: "1m", target: 200 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  const choice = Math.random();
  if (choice < 0.4) {
    cmsList();
  } else if (choice < 0.7) {
    entriesList();
  } else {
    syncUpsert();
  }
}
