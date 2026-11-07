import {
  PlasmicComponent,
  PlasmicRootProvider,
} from "@plasmicapp/loader-react";
import {
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from "react-router-dom";
import "./App.css";
import { PLASMIC } from "./init-plasmic";

function App() {
  return (
    <PlasmicRootProvider loader={PLASMIC}>
      <Router>
        <Routes>
          <Route
            path="/components"
            element={
              <>
                <h2>Fake Footer</h2>
                <PlasmicComponent component={"Footer"} />
                <h2>Fake PriceTier</h2>
                <PlasmicComponent
                  component={"PriceTier"}
                  componentProps={{
                    title: "Fake Tier",
                    price: "$100",
                    valueProps: (
                      <div>
                        I am so <strong>VERY COOL</strong>
                      </div>
                    ),
                    children: <em>Do it now!!!</em>,
                  }}
                />
                <h2>Fake testimonials</h2>
                <PlasmicComponent component="Testimonials" />
              </>
            }
          />
          {
            // Catch-all route
          }
          <Route path="*" element={<DynamicPage />} />
        </Routes>
      </Router>
    </PlasmicRootProvider>
  );
}

function DynamicPage() {
  const location = useLocation();
  return <PlasmicComponent component={location.pathname} />;
}

export default App;
