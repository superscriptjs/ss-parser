> topic:system hello_world {random} (a, b, c) ^filter()
+ this is a trigger with a multiline response
- hello this goes
^ over multiple lines
^ and it's fun

/* multiline
comment
+ with trigger
- I AM COMMENT
*/ //disregard
// everything
// here

+ this is a conversation
% what I * previously said
- {keep} response woohoo

+ hello
- no

%% (d === true)
+ conditional
- yay

%% (myCond == false) {
%% (nestedconditional == true)
+ hi
- bye
}

+ here's a redirect
@ go here

+ {^filterme()} this one is a filter
- yeah!

+ yo there, how's it going?? i'm *(2, 2)! hi...!
- you suck
- lame

+ sup * my name is *~1
- hi

+ this is an [optional|no] word
- ok
< topic

? question outside topic *
- yeah

// reply options
// keep = ['keep', 'exhaust']
// order = ['random', 'ordered']

+ {keep, ordered} test random
- reply

? {ordered, keep} test random 2
- reply

