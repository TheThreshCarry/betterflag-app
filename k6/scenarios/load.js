import { cmsList, cmsGetBySlug } from "../scripts/cms-content-types.js";
import { entriesList } from "../scripts/cms-entries.js";

export const options = {
  stages: [
    { duration: "1m", target: 20 },
    { duration: "3m", target: 50 },
    { duration: "2m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const choice = Math.random();
  if (choice < 0.5) {
    cmsList();
  } else if (choice < 0.8) {
    entriesList();
  } else {
    cmsGetBySlug();
  }
}
