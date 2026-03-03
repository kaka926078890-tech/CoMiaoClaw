import { ConsoleLogProvider } from "@/context/ConsoleLogContext";
import { ChatConsole } from "@/components/ChatConsole";
import "@/index.css";

function App() {
  return (
    <ConsoleLogProvider>
      <ChatConsole />
    </ConsoleLogProvider>
  );
}

export default App;
