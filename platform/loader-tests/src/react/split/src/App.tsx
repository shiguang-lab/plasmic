import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import Raw from "./Raw";
import Schedule from "./Schedule";
import Segment from "./Segment";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/segment" element={<Segment />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="*" element={<Raw />} />
      </Routes>
    </Router>
  );
}

export default App;
