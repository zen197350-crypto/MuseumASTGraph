import { Graphviz } from 'https://esm.sh/@hpcc-js/wasm@2.16.2';

let graphvizInstance: Graphviz | null = null;

export const getGraphvizInstance = async (): Promise<Graphviz> => {
  if (!graphvizInstance) {
    try {
      graphvizInstance = await Graphviz.load();
    } catch (e) {
      console.error("Failed to load Graphviz WASM:", e);
      throw new Error("Failed to load Graphviz engine. Please check your internet connection.");
    }
  }
  return graphvizInstance;
};

// Inject forced styles to ensure visibility and size
const injectForcedStyles = (dot: string): string => {
  // Find the first opening brace '{'
  const braceIndex = dot.indexOf('{');
  if (braceIndex === -1) return dot;

  // Force light gray background (#e2e8f0 / slate-200) so white nodes stand out.
  // Force larger fonts (28pt is approx 2x default 14pt).
  // Force larger minimum node sizes and thicker pens for better visibility.
  const styles = `
    graph [bgcolor="#e2e8f0", fontsize=28];
    node [fontsize=28, height=1, width=1, penwidth=2];
    edge [fontsize=28, penwidth=2];
  `;

  // Insert styles at the beginning of the graph body
  return dot.slice(0, braceIndex + 1) + "\n" + styles + "\n" + dot.slice(braceIndex + 1);
};

export const layoutDot = async (dot: string, engine: string = 'dot'): Promise<string> => {
  const gv = await getGraphvizInstance();
  const enhancedDot = injectForcedStyles(dot);
  return gv.layout(enhancedDot, "svg", engine);
};