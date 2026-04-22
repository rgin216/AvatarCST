import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [status, setStatus] = useState("");

  useEffect(() => {
    axios.get("http://localhost:5000/api/health")
      .then(res => setStatus(res.data.status))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div>
      <h1>AvatarCST</h1>
      <p>Backend status: {status}</p>
    </div>
  );
}

export default App;