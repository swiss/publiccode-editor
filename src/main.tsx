import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { loadWasm } from "./app/validator";

console.log(`${__APP_NAME__} ${__APP_VERSION__} (${__APP_COMMIT__})`);

loadWasm()
  .catch((e) => console.error(`Failed to load Wasm: ${e}`))
  .then((res) => {
    console.log("loadWasm OK");
    return res;
  });

createRoot(document.getElementById("app")!).render(<App />);
