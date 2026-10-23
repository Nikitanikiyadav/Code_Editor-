// Turns a raw error into a beginner-friendly explanation.
// Rule-based: it checks the error type and message against common patterns.
const generic = (type, message) => ({
  explanation: `The program stopped with a ${type}: "${message}".`,
  tip: 'Read the message and the underlined line carefully. If it is still unclear, search the exact error text online.',
})

function explainPython(type, message) {
  switch (type) {
    case 'SyntaxError':
      return {
        explanation: "Python could not understand the structure of your code, so it didn't run anything.",
        tip: "Check this line and the one above it: a missing colon (:) after if/for/while/def, a bracket or quote that was never closed, or a misspelled keyword.",
      }
    case 'IndentationError':
    case 'TabError':
      return {
        explanation: 'Python uses spaces at the start of a line to group code, and the spacing is inconsistent here.',
        tip: "After a line ending with ':' the next line must be indented. All lines in the same block need the same number of spaces. Don't mix tabs and spaces.",
      }
    case 'NameError': {
      const name = /name '(.+?)' is not defined/.exec(message)?.[1]
      return {
        explanation: name
          ? `You used "${name}" but Python has never heard of it. It was not created yet, or it is misspelled.`
          : 'You used a name that does not exist yet.',
        tip: 'Create the variable or function before using it, and check the spelling. Python is case-sensitive, so name and Name are different.',
      }
    }
    case 'TypeError':
      if (/unsupported operand|can only concatenate|must be str|cannot concatenate/.test(message))
        return {
          explanation: 'You tried to combine two different kinds of values, such as text and a number.',
          tip: 'Convert one of them: int("5") turns text into a number, and str(5) turns a number into text.',
        }
      if (/not callable/.test(message))
        return {
          explanation: 'You put () after something that is not a function, for example a number or a list.',
          tip: 'Remove the () or check that the name is not reused for something else.',
        }
      if (/positional argument/.test(message))
        return {
          explanation: 'A function was called with the wrong number of arguments.',
          tip: 'Compare the call with the def line and pass exactly the parameters it expects.',
        }
      if (/not subscriptable|NoneType/.test(message))
        return {
          explanation: 'You used [] or an operation on a value that does not support it. Often the value is None because a function returned nothing.',
          tip: 'Print the value just before this line to see what it really is.',
        }
      return generic(type, message)
    case 'ZeroDivisionError':
      return {
        explanation: 'You divided a number by zero, which is mathematically impossible.',
        tip: 'Check the value of the divisor before dividing, for example with: if b != 0:',
      }
    case 'IndexError':
      return {
        explanation: 'You asked for a list position that does not exist.',
        tip: 'Positions start at 0 and the last valid one is len(list) - 1. Check your loop range.',
      }
    case 'KeyError':
      return {
        explanation: `The dictionary has no key ${message}.`,
        tip: 'Check the spelling of the key, or use dict.get(key) which returns None instead of crashing.',
      }
    case 'ValueError':
      return {
        explanation: 'The value has the right type but an unacceptable content, such as int("abc").',
        tip: 'Check what the user or the data actually contains before converting it.',
      }
    case 'AttributeError':
      return {
        explanation: 'You used a dot (.something) that this kind of value does not have.',
        tip: 'Check the spelling and the value type. Print type(value) to see what it really is.',
      }
    case 'ModuleNotFoundError':
    case 'ImportError':
      return {
        explanation: 'Python cannot find the module you tried to import.',
        tip: 'The in-browser Python has the standard library only (math, random, json, collections, ...). Packages like numpy or requests are not available here.',
      }
    case 'EOFError':
      return {
        explanation: 'The code called input(), but interactive input is not supported in this runner.',
        tip: 'Replace input() with a fixed value for now, for example name = "Asha".',
      }
    case 'RecursionError':
      return {
        explanation: 'A function kept calling itself and never stopped.',
        tip: 'Add a base case, a condition where the function returns without calling itself again.',
      }
    case 'LoadError':
      return {
        explanation: 'The Python runtime is downloaded from the internet the first time it is used, and the download failed.',
        tip: 'Check your internet connection and press Run again.',
      }
    default:
      return generic(type, message)
  }
}

function explainJavaScript(type, message) {
  switch (type) {
    case 'ReferenceError': {
      if (/before initialization/.test(message))
        return {
          explanation: 'You used a let/const variable before the line that creates it.',
          tip: 'Move the declaration above the first place you use it.',
        }
      const name = /(\S+) is not defined/.exec(message)?.[1]
      return {
        explanation: name
          ? `You used "${name}" but it was never created, or it is misspelled.`
          : 'You used a name that does not exist.',
        tip: 'Declare it with let or const first, and check the spelling. JavaScript is case-sensitive.',
      }
    }
    case 'TypeError':
      if (/Cannot read propert|Cannot set propert/.test(message))
        return {
          explanation: 'You used a dot on a value that is undefined or null, so there is nothing to read from.',
          tip: 'Print the value before this line. Optional chaining helps: user?.name',
        }
      if (/is not a function/.test(message))
        return {
          explanation: 'You tried to call something that is not a function.',
          tip: 'Check the spelling of the method name and the type of the value (arrays, strings and objects have different methods).',
        }
      if (/Assignment to constant/.test(message))
        return {
          explanation: 'You changed a variable that was declared with const.',
          tip: 'Use let if the value needs to change.',
        }
      if (/is not iterable/.test(message))
        return {
          explanation: 'You used a loop or spread on something that is not a list-like value.',
          tip: 'Make sure the value is an array or string before looping over it.',
        }
      return generic(type, message)
    case 'SyntaxError':
      return {
        explanation: "JavaScript could not understand the structure of your code, so nothing ran.",
        tip: 'Look for a missing or extra bracket ) ] }, an unclosed quote, a missing comma, or a stray character.',
      }
    case 'RangeError':
      if (/call stack/.test(message))
        return {
          explanation: 'A function kept calling itself and never stopped.',
          tip: 'Add a base case where the function returns without calling itself.',
        }
      return generic(type, message)
    case 'LoadError':
      return generic(type, message)
    default:
      return generic(type, message)
  }
}

export function explainError(language, error) {
  const { type, message } = error
  return language === 'python'
    ? explainPython(type, message)
    : explainJavaScript(type, message)
}