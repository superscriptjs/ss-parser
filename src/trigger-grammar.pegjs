{
  function makeInteger(o) {
    return parseInt(o.join(""), 10);
  }

  function starminmax(min, max) {
    var expression;
    if (min === max) {
      return `\\s*(\\s?(?:[\\w-:]*\\??\\.?\\,?\\s*\\~?\\(?\\)?){0,${min}})`;
    } else if (min < 2) {
      expression = "\\s*((?:\\(?\\~?[\\w-:]+[\\?\\.\\'\\,\\s\\~\\)]*?)";
    } else {
      expression = "\\s*((?:\\(?\\~?[\\w-:]+[\\?\\.\\'\\,\\s\\~\\)]+[\\w-:]+[\\?\\.\\'\\,\\s\\~\\)]*?)";
    }
    return `${expression}{${min},${max}})\\s?`;
  }
}

start
  = trigger

star
  = "*" { return { raw: "*", clean: "\\s(?:.*\\s)?" }; }
  / "(" ws* "*" ws* ")" { return { raw: "(*)", clean: "\\s(.*)\\s" }; }

starn
  = "*" val:integer { return { raw: `*${val}`, clean: `(\\S+(?:\\s+\\S+){${parseInt(val) - 1}})` }; }
  / "*(" val:integer ")" { return { raw: `*(${val})`, clean: `(\\S+(?:\\s+\\S+){${parseInt(val) - 1}})` }; }

starupton
  = "*~" val:integer { return { raw: `*~${val}`, clean: `\\s*(\\s?(?:[\\w-:~]*\\??\\.?\\,?\\s*\\~?\\(?\\)?){0,${parseInt(val)}})` }; }

starminmax
  = "*(" ws1:ws* min:integer ws2:ws* "," ws3:ws* max:integer ws4:ws* ")"
    { return { raw: `*(${ws1}${min}${ws2},${ws3}${max}${ws4})`, clean: starminmax(parseInt(min), parseInt(max)) }; }
  / "*(" ws1:ws* min:integer ws2:ws* "-" ws3:ws* max:integer ws4:ws* ")"
    { return { raw: `*(${ws1}${min}${ws2},${ws3}${max}${ws4})`, clean: starminmax(parseInt(min), parseInt(max)) }; }

string
  = str:[a-zA-Z]+ { return { type: "string", val: str.join("")}; }

cleanedString
  = strings:(wsl:ws* string:[^|()\[\]\n\r \t*]+ wsr:ws* { return { raw: `${wsl.join("")}${string.join("")}${wsr.join("")}`, clean: `${string.join("")}` }; })+
    {
      return {
        raw: strings.map((string) => string.raw).join(""),
        clean: strings.map((string) => string.clean).join(" ")
      };
    }

alternates
  = "(" alternates:(cleanedString:cleanedString "|" { return { raw: `${cleanedString.raw}|`, clean: `\\b${cleanedString.clean}\\b|` }; })+ alternate:cleanedString  ")"
    {
      return {
        raw: `(${alternates.map((alternate) => alternate.raw).join("").concat(alternate.raw)})`,
        clean: `(${alternates.map((alternate) => alternate.clean).join("").concat(`\\b${alternate.clean}\\b`)})\\s?`
      };
    }

optionals
  = "[" alternates:(cleanedString:cleanedString "|" { return { raw: `${cleanedString.raw}|`, clean: `\\s*${cleanedString.clean}\\s*|` }; })* alternate:cleanedString  "]"
    {
      return {
        raw: `[${alternates.map((alternate) => alternate.raw).join("").concat(alternate.raw)}]`,
        clean: `(?:${alternates.map((alternate) => alternate.clean).join("").concat(`\\s*${alternate.clean}\\s*|\\s*`)})`
      };
    }
  / "[" ws* "*" ws* "]"
    {
      return {
        raw: "[*]",
        clean: "(?:.*\\s?)"
      };
    }

EOF
  = !.

// Special-case regexes for first, last and only token.
// This is necessary since stars have different regexes depending on whether they are
// at the beginning, in the middle or at the end of a trigger.
firstToken
  = ws* "*" ws+
    { return { raw: '* ', clean: "(?:.*\\s)?" }; }
  / ws* "[" ws* "*" ws* "]" ws+
    { return { raw: '[*] ', clean: "(?:.*\\s)?" }; }
  / ws* "(" ws* "*" ws* ")" ws+
    { return { raw: '(*) ', clean: "(.*\\s)" }; }

lastToken
  = ws* "*" ws* EOF
    { return { raw: ' *', clean: "(?:\\s.*)?" }; }
  / ws* "[" ws* "*" ws* "]" ws* EOF
    { return { raw: ' [*]', clean: "(?:\\s.*)?" }; }
  / ws* "(" ws* "*" ws* ")" ws* EOF
    { return { raw: ' (*)', clean: "(\\s.*)" }; }

onlyToken
  = ws* "*" ws* EOF
    { return { raw: '*', clean: "(?:.*?)" }; }
  / ws* "[" ws* "*" ws* "]" ws* EOF
    { return { raw: '*', clean: "(?:.*?)" }; }
  / ws* "(" ws* "*" ws* ")" ws* EOF
    { return { raw: '*', clean: "(.*)" }; }

triggerTokens
  = lastToken:lastToken
    { return lastToken; }
  / alternates:alternates
    { return alternates; }
  / wsl:ws* optionals:optionals wsr:ws*
    { return { raw: `${wsl.join("")}${optionals.raw}${wsr.join("")}`, clean: optionals.clean } }
  / wsl:ws* starn:starn wsr:ws*
    { return { raw: `${wsl.join("")}${starn.raw}${wsr.join("")}`, clean: `${wsl.join("")}${starn.clean}${wsr.join("")}` }; }
  / wsl:ws* starupton:starupton wsr:ws*
    { return { raw: `${wsl.join("")}${starupton.raw}${wsr.join("")}`, clean: starupton.clean }; }
  / wsl:ws* starminmax:starminmax wsr:ws*
    { return { raw: `${wsl.join("")}${starminmax.raw}${wsr.join("")}`, clean: starminmax.clean }; }
  / wsl:ws* star:star wsr:ws*
    { return { raw: `${wsl.join("")}${star.raw}${wsr.join("")}`, clean: star.clean }; }
  / string:escapedCharacter+
    { return { raw: string.join(""), clean: `${string.join("")}` };}
  / ws:ws
    { return { raw: ws, clean: ws }; }

trigger
  = onlyToken:onlyToken
    { return onlyToken; }
  / firstToken:firstToken? tokens:triggerTokens*
    {
      let raw = firstToken ? firstToken.raw : '';
      let clean = firstToken ? firstToken.clean : '';
      return {
        raw: raw.concat(tokens.map((token) => token.raw).join("")),
        clean: clean.concat(tokens.map((token) => token.clean).join(""))
      };
    }

escapedCharacter
  = "\\" character:[*~?\[\]\(\)]
    { return `\\${character}`; }
  / character:[+?*]
    { return `\\${character}`; }
  / character:[^*\n\r \t]
    { return character; }

integer "integer"
  = digits:[0-9]+ { return makeInteger(digits); }

ws "whitespace" = [ \t]

nl "newline" = [\n\r]
