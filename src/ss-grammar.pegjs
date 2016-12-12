{
  function makeInteger(o) {
    return parseInt(o.join(""), 10);
  }
}

start
  = data:(gambitsStart:gambits?
      data:(topics:topics gambits:gambits? { return { topics, gambits }; })*
      {
        var topics = [];
        var gambits = [];
        data.forEach((data) => {
          if (data.topics) data.topics.forEach((topic) => topics.push(topic));
          if (data.gambits) data.gambits.forEach((gambit) => gambits.push(gambit));
        });
        if (gambitsStart) gambitsStart.forEach((gambit) => gambits.push(gambit));
        return { topics, gambits };
      }
    ) {
      return data;
    }

argCharacter
  = "\\" char:[()] { return char; }
  / !")" char:. { return char; }

args
  = argChars:argCharacter+
    { return argChars.join(""); }

gambitfilter
  = "{^" filter:[a-zA-Z0-9_]+ "(" args:args? ")}"
    { return `^${filter.join("")}(${args || ''})`; }

topicfilter
  = "^" filter:[a-zA-Z0-9_]+ "(" args:args? ")"
    { return `^${filter.join("")}(${args || ''})`; }

topickeyword
  = keyword:[a-zA-Z_]+ { return keyword.join(""); }

topickeywords
  = "(" ws* keywords:(keyword:topickeyword ws* { return keyword; })* ")" { return keywords; }

topicflagvalues
  = "keep" { return "keep"; }
  / "nostay" { return "nostay"; }
  / "system" { return "system"; }

ordervalues
  = "ordered"
  / "random"

keepvalues
  = "keep"
  / "exhaust"

replyoption
  = keepvalue:keepvalues { return { keep: keepvalue }; }
  / ordervalue:ordervalues { return { order: ordervalue }; }

replyoptions
  = "{" ws* firstOption:replyoption ws* options:("," ws* option:replyoption ws* { return option; })* ws* "}" { return options.concat(firstOption) || []; }
  / "{" ws* firstOption:replyoption ws* "}" { return firstOption || []; }

topicflag
  = ":" flag:topicflagvalues { return flag; }

topicflags
  = flag:topicflag* { return flag; }

topicoptions
  = ws+ filter:topicfilter ws* keywords:topickeywords? { return { keywords: keywords || [], filter: filter }; }
  / ws+ keywords:topickeywords ws* filter:topicfilter? { return { keywords: keywords, filter: filter }; }

topic
  = ws* "> topic"
    flags:topicflags " "
    name:[a-zA-Z0-9_~]+
    options:topicoptions? nl+
    gambits:gambits
    ws* "< topic"
    {
      return {
        name: name.join(""),
        flags: flags,
        keywords: options ? options.keywords : [],
        filter: options ? options.filter : null,
        gambits
      };
    }
  / ws* "> pre" nl+
    gambits:gambits
    ws* "< pre"
    {
      return {
        name: "__pre__",
        flags: ["keep"],
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
        flags: ["keep"],
        keywords: [],
        filter: null,
        gambits
      };
    }

topics
  = topics:(topic:topic nl+ { return topic; })+ { return topics; }

string
  = str:[a-zA-Z]+ { return { type: "string", val: str.join("")}; }

redirect
  = ws* "@ " redirect:[a-zA-Z_ ]+ { return redirect.join(""); }

trigger
  = ws* "+" ws+ filter:(filter:gambitfilter ws+ { return filter; })? ws? reply_options:(reply_options:replyoptions ws* { return reply_options; })* tokens:[^\n\r]+
  {
    const flatten = list => list.reduce(
        (a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []
    );
    var props = {};
    if (reply_options && reply_options.length !== 0) {
      reply_options = flatten(reply_options);
      for(var i = 0; i < reply_options.length; i++) {
        var obj1 = reply_options[i];
        for (var attrname in obj1) { props[attrname] = obj1[attrname]; }
      }
    }
    return {
      reply_options: props || {},
      filter: filter,
      question: null,
      raw: tokens.join("")
    };
  }
  / ws* "?" ws+ filter:(filter:gambitfilter ws+ { return filter; })? ws? reply_options:replyoptions? ws* tokens:[^\n\r]+
  {
    const flatten = list => list.reduce(
        (a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []
    );
    var props = {};
    if (reply_options && reply_options.length !== 0) {
      for(var i = 0; i < reply_options.length; i++) {
        var obj1 = reply_options[i];
        for (var attrname in obj1) { props[attrname] = obj1[attrname]; }
      }
    }
    return {
      reply_options: props || {},
      filter: filter,
      question: true,
      raw: tokens.join("")
    };
  }

replyExtension
  = nl ws* "^" ws+ string:[^\n\r]+ { return string.join(""); }

reply
  = ws* "-" ws+ string:[^\n\r]+ replyExtension:replyExtension*
    {
      var replyString = string.join("");
      if (replyExtension) {
        replyExtension.forEach((extension) => replyString = replyString.concat(`${extension}`));
      }
      return replyString;
    }

replies
  = reply2:reply replies:(nl reply:reply { return reply; })*
    {
      replies.push(reply2);
      return replies;
    }

conditional
  = ws* "%% (" string:[a-zA-Z0-9_= ]+ ")"
      { return string.join(""); }

star
  = "*" { return { raw: "*", clean: "(?:.*\\s?)" }; }

conversationTokens
  = string:[^*\n\r \t]+
    { return { raw: string.join(""), clean: `${string.join("")}\\b` };}
  / wsl:ws* star:star wsr:ws*
    { return { raw: `${wsl.join("")}${star.raw}${wsr.join("")}`, clean: star.clean }; }
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
        trigger: { raw: "*", clean: "(?:.*\\s?)", filter: null, question: null },
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
        trigger: { raw: "*", clean: "(?:.*\\s?)" },
        redirect,
        conditional: [conditional],
        conversation
      };
    }


gambitsBlock
  = conditional:conditional ws* "{" nl+ gambits:(gambit:gambit nl+ { return gambit; })+ nl* ws* "}" nl+
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
    / gambits:(gambit:gambit nl+ { return gambit; })+
      { return gambits; }

gambits
  = gambitsBlock:gambitsBlock+
    {
      var returnedGambits = [];
      gambitsBlock.forEach((gambitBlock) => {
        gambitBlock.forEach((gambit) => {
          returnedGambits.push(gambit);
        });
      });
      return returnedGambits;
    }

integer "integer"
  = digits:[0-9]+ { return makeInteger(digits); }

ws "whitespace" = [ \t]

nl "newline" = [\n\r]
