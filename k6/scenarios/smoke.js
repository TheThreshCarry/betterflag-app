import { cmsList } from "../scripts/cms-content-types.js";
import { entriesList } from "../scripts/cms-entries.js";

export const options = {
  vus: 1,
  iterations: 10,
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  cmsList();
  entriesList();
}
