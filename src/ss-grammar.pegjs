{
  const makeInteger = (int) => parseInt(int.join(""), 10);
  const merge = (arr) => Object.assign({}, ...arr);
}

start
  = data:gambitsOrTopic*
  {
    const topics = [];
    const gambits = [];
    data.forEach((item) => {
      if (item.type === 'gambits') {
        item.payload.forEach(gambit => gambits.push(gambit));
      } else if (item.type === 'topic') {
        topics.push(item.payload);
      }
    });
    return { topics, gambits };
  }

gambitsOrTopic
  = gambits:gambits { return { type: 'gambits', payload: gambits }; }
  / topic:topic nlOrEOF { return { type: 'topic', payload: topic }; }

argCharacter
  = "\\" char:[()] { return char; }
  / !")" char:. { return char; }

args
  = argChars:argCharacter+
    { return argChars.join(""); }

filter
  = "^" filter:[a-zA-Z0-9_]+ "(" args:args? ")"
    { return `^${filter.join("")}(${args || ''})`; }

gambitFilter
  = "{" ws* filter:filter ws* "}"
    { return filter; }

replyFilter
  = "{" ws* filter:filter ws* "}"
    { return filter; }

topicKeyword
  = keyword:[a-zA-Z_]+ { return keyword.join(""); }

topicKeywords
  = "(" ws* firstKeyword:topicKeyword ws* keywords:("," ws* keyword:topicKeyword ws* { return keyword; })* ws* ")"
    { return [firstKeyword].concat(keywords); }

orderValues
  = "ordered"
  / "random"

keepValues
  = "keep"
  / "exhaust"
  / "reload"

stayValues
  = "stay"
  / "nostay"

systemValues
  = "system"
  / "nonsystem"

// The === below is used for flags that make sense as booleans.

replyFlag
  = keepValue:keepValues { return { keep: keepValue }; }

gambitFlag
  = keepValue:keepValues { return { keep: keepValue }; }
  / orderValue:orderValues { return { order: orderValue }; }

topicFlag
  = keepValue:keepValues { return { keep: keepValue }; }
  / orderValue:orderValues { return { order: orderValue }; }
  / stayValue:stayValues { return { stay: stayValue === "stay" }; }
  / systemValue:systemValues { return { system: systemValue === "system" }; }

// e.g. { keep, ordered, nostay, ... }
replyFlags
  = "{" ws* firstFlag:replyFlag ws* flags:("," ws* flag:replyFlag ws* { return flag; })* ws* "}"
    { return merge([firstFlag].concat(flags)); }

gambitFlags
  = "{" ws* firstFlag:gambitFlag ws* flags:("," ws* flag:gambitFlag ws* { return flag; })* ws* "}"
    { return merge([firstFlag].concat(flags)); }

topicFlags
  = "{" ws* firstFlag:topicFlag ws* flags:("," ws* flag:topicFlag ws* { return flag; })* ws* "}"
    { return merge([firstFlag].concat(flags)); }

topicOption
  = filter:filter { return { filter }; }
  / keywords:topicKeywords { return { keywords }; }
  / topicFlags:topicFlags { return { flags: topicFlags }; }

topicOptions
  = options:(ws* option:topicOption { return option; })* ws*
    { return merge(options); }

topic
  = ws* "> topic "
    name:[a-zA-Z0-9_]+
    options:topicOptions? nl+
    gambits:gambits
    ws* "< topic"
    {
      return {
        name: name.join(""),
        flags: (options && options.flags) || {},
        keywords: (options && options.keywords) || [],
        filter: (options && options.filter) || null,
        gambits
      };
    }
  / ws* "> pre" nl+
    gambits:gambits
    ws* "< pre"
    {
      return {
        name: "__pre__",
        flags: { keep: "keep" },
        keywords: [],
        filter: null,
        gambits
      };
    }
  / ws* "> post" nl+
    gambits:gambits
    ws* "< post"
    {
      return {
        name: "__post__",
        flags: { keep: "keep" },
        keywords: [],
        filter: null,
        gambits
      };
    }

string
  = str:[a-zA-Z]+ { return { type: "string", val: str.join("")}; }

redirect
  = ws* "@ " redirect:[a-zA-Z_ ]+ { return redirect.join(""); }

triggerOption
  = filter:gambitFilter { return { filter }; }
  / flags:gambitFlags { return { flags }; }

triggerOptions
  = options:(ws* option:triggerOption { return option; })* ws*
    { return merge(options); }

trigger
  = ws* "+" options:triggerOptions? tokens:[^\n\r]+
  {
    return {
      flags: (options && options.flags) || {},
      filter: (options && options.filter) || null,
      question: false,
      raw: tokens.join("")
    };
  }
  / ws* "?" options:triggerOptions? ws* tokens:[^\n\r]+
  {
    return {
      flags: (options && options.flags) || {},
      filter: (options && options.filter) || null,
      question: true,
      raw: tokens.join("")
    };
  }

replyExtension
  = nl ws* "^" ws+ string:[^\n\r]+ { return string.join(""); }

replyOption
  = filter:replyFilter { return { filter }; }
  / flags:topicFlags { return { flags }; }

replyOptions
  = options:(ws* option:replyOption { return option; })*
    { return merge(options); }

reply
  = ws* "-" options:replyOptions? ws* string:[^\n\r]+ replyExtension:replyExtension*
    {
      var replyString = string.join("");
      if (replyExtension) {
        replyExtension.forEach((extension) => replyString = replyString.concat(extension));
      }
      return {
        string: replyString,
        filter: (options && options.filter) || null,
        keep: (options.flags && "keep" in options.flags) ? options.flags.keep : false
      };
    }

replies
  = firstReply:reply replies:(nl reply:reply { return reply; })*
    { return [firstReply].concat(replies); }

conditional
  = ws* "%% (" string:[a-zA-Z0-9_= ]+ ")"
      { return string.join(""); }

star
  = "*" { return { raw: "*", clean: "(?:(?=^|\\s)\\s*(?:.*)(?=\\s|$)\\s*)?" }; }

conversationTokens
  = string:[^*\n\r \t]+
    { return { raw: string.join(""), clean: `${string.join("")}` };}
  / wsl:ws* star:star wsr:ws*
    { return { raw: ` ${star.raw} `, clean: star.clean }; }
  / ws:ws { return { raw: ws, clean: ws }; }

// Do cleaning as a postprocess with the trigger parser
conversation
  = ws* "% " tokens:conversationTokens+
    {
      return {
        raw: tokens.map((token) => token.raw).join("")
      };
    }

gambit
  = conditional:(conditional:conditional nl { return conditional; })?
    trigger:trigger
    nl
    conversation:(conversation:conversation nl { return conversation; })?
    replies:replies
    {
      return {
        trigger,
        replies,
        conditional: (conditional ? [conditional] : null),
        conversation
      };
    }
  / conditional:(conditional:conditional nl { return conditional; })?
    trigger:trigger
    nl
    conversation:(conversation:conversation nl { return conversation; })?
    redirect:redirect
    {
      return {
        trigger,
        redirect,
        conditional: (conditional ? [conditional] : null),
        conversation
      };
    }
  / conditional:conditional nl
    conversation:(conversation:conversation nl { return conversation; })?
    replies:replies
    {
      return {
        trigger: { raw: "*", clean: "(?:.*)", filter: null, question: false, flags: {} },
        replies,
        conditional: [conditional],
        conversation
      };
    }
  / conditional:conditional nl
    conversation:(conversation:conversation nl { return conversation; })?
    redirect:redirect
    {
      return {
        trigger: { raw: "*", clean: "(?:.*)", filter: null, question: false, flags: {} },
        redirect,
        conditional: [conditional],
        conversation
      };
    }

gambitBlock
  = conditional:conditional ws* "{" nl+ gambits:(gambit:gambit nl+ { return gambit; })+ nl* ws* "}" nlOrEOF
    {
      gambits.forEach((gambit) => {
        if (gambit.conditional) {
          gambit.conditional.push(conditional);
        } else {
          gambit.conditional = [conditional];
        }
      });
      return gambits;
    }
  / gambits:(gambit:gambit nlOrEOF { return gambit; })+
    { return gambits; }

gambits
  = gambitBlocks:gambitBlock+
  {
    let gambits = [];
    gambitBlocks.forEach((gambitBlock) => {
      gambits = gambits.concat(gambitBlock);
    });
    return gambits;
  }

integer "integer"
  = digits:[0-9]+ { return makeInteger(digits); }

ws "whitespace" = [ \t]

nl "newline" = [\n\r]

nlOrEOF
  = nl+
  / !.
