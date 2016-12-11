> topic:keep hello_world ^test() (keywords ok)
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

+ {replies_ordered} question outside topic *
- yeah
