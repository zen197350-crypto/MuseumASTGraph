import { CosmeticAction } from '../types';

export const modifyDotCode = (code: string, action: CosmeticAction, enable: boolean): string => {
  let newCode = code;

  // Helper to insert at start of graph body if no modifications matches were found
  const insertAtStart = (injection: string) => {
    const openBraceIndex = newCode.indexOf('{');
    if (openBraceIndex !== -1) {
      const pre = newCode.substring(0, openBraceIndex + 1);
      const post = newCode.substring(openBraceIndex + 1);
      return pre + '\n  ' + injection + '\n' + post;
    }
    return newCode;
  };

  // Helper to remove global injections (e.g. "node [shape=circle];")
  const removeGlobalInjection = (injectionBody: string) => {
    const escapedBody = injectionBody.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
    const regex = new RegExp(`\\s*${escapedBody}\\s*;?`, 'g');
    return newCode.replace(regex, '');
  };

  // Helper to remove specific attribute/value pairs globally
  const removeAttribute = (inputCode: string, attribute: string) => {
     const escapedAttr = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
     // Matches: space* attribute space* comma?
     const regex = new RegExp(`\\s*${escapedAttr}\\s*,?`, 'gi');
     return inputCode.replace(regex, '');
  };

  switch (action) {
    case 'circles': {
      const injection = 'shape="circle"';
      const fullInjection = 'shape="circle", ';
      const globalInjection = 'node [shape="circle"];';

      if (enable) {
        const regex = /\bnode\s*\[/gi;
        if (regex.test(newCode)) {
          newCode = newCode.replace(regex, `node [${fullInjection}`);
        } else {
          newCode = insertAtStart(globalInjection);
        }
      } else {
        newCode = removeGlobalInjection(globalInjection);
        newCode = removeAttribute(newCode, injection);
      }
      break;
    }

    case 'fixedSize': {
      const injection = 'fixedsize=true';
      const fullInjection = 'fixedsize=true, ';
      const globalInjection = 'node [fixedsize=true];';

      if (enable) {
        const regex = /\bnode\s*\[/gi;
        if (regex.test(newCode)) {
          newCode = newCode.replace(regex, `node [${fullInjection}`);
        } else {
          newCode = insertAtStart(globalInjection);
        }
      } else {
        newCode = removeGlobalInjection(globalInjection);
        newCode = removeAttribute(newCode, injection);
      }
      break;
    }

    case 'compact': {
      // Two attributes
      const injection1 = 'ranksep=0.1';
      const injection2 = 'nodesep=0.1';
      const fullInjection = 'ranksep=0.1, nodesep=0.1, ';
      const globalInjection = 'graph [ranksep=0.1, nodesep=0.1];';

      if (enable) {
        const regex = /\bgraph\s*\[/gi;
        if (regex.test(newCode)) {
          newCode = newCode.replace(regex, `graph [${fullInjection}`);
        } else {
          newCode = insertAtStart(globalInjection);
        }
      } else {
        newCode = removeGlobalInjection(globalInjection);
        newCode = removeAttribute(newCode, injection1);
        newCode = removeAttribute(newCode, injection2);
      }
      break;
    }

    case 'thickEdges': {
      const injection = 'penwidth=2.5';
      const fullInjection = 'penwidth=2.5, ';
      const globalInjection = 'edge [penwidth=2.5];';

      if (enable) {
        const regex = /\bedge\s*\[/gi;
        if (regex.test(newCode)) {
          newCode = newCode.replace(regex, `edge [${fullInjection}`);
        } else {
          newCode = insertAtStart(globalInjection);
        }
      } else {
        newCode = removeGlobalInjection(globalInjection);
        newCode = removeAttribute(newCode, injection);
      }
      break;
    }

    case 'thinOutlines': {
      // Sequence
      const injection = 'style=filled, color=black, penwidth=1';
      const fullInjection = 'style=filled, color=black, penwidth=1, ';
      const globalInjection = 'node [style=filled, color=black, penwidth=1];';

      if (enable) {
        const regex = /\bnode\s*\[/gi;
        if (regex.test(newCode)) {
          newCode = newCode.replace(regex, `node [${fullInjection}`);
        } else {
          newCode = insertAtStart(globalInjection);
        }
      } else {
        newCode = removeGlobalInjection(globalInjection);
        newCode = removeAttribute(newCode, injection);
      }
      break;
    }
  }

  return newCode;
};

export const extractColors = (code: string): Set<string> => {
  const colors = new Set<string>();
  const colorRegex = /\b(fillcolor|color)\s*=\s*"?([a-zA-Z0-9#]+)"?/g;
  
  let match;
  while ((match = colorRegex.exec(code)) !== null) {
    if (match[2]) {
      colors.add(match[2]);
    }
  }
  return colors;
};