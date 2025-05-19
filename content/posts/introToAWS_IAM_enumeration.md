---
title: "Intro to AWS & IAM Enumeration"
date: 2025-05-15
draft: false
language: en
featured_image: ../assets/images/posts/pacuIcon.png
summary: A walkthrough of the Intro to AWS Pentesting IAM Enumeration with Pacu Challenge
authorimage: ../assets/images/posts/cyber-immuno-fusion.png
categories: Blog
tags: ["AWS Pentesting", "IAM", "AWS", "Enumeration", "Pacu"]
---
# Introduction & Context

Hey guys! This write-up is for the Intro to AWS IAM Enumeration with Pacu challenge, available [here](https://academy.simplycyber.io/l/pdp/introduction-to-aws-pentesting). If you don't know what that is, it's a full course that teaches you how to hack (ethically of course) AWS, using both automated and manual methods. At the time of writing, I've only completed the first few chapters, but have learned so much about AWS already. Check it out!

I'm writing this out in a way that gives readers an idea of how I thought through this, as a beginner, and the commands I used. If you're an experienced hacker, this write-up may have some nitty gritty details you could do without. But for those who are just getting into this (like me), this will hopefully guide you through all the steps nice and easily. Now with that out of the way, let's get started!

# Download & Setup

If you followed through with the course to this point, you should have all the dependencies already installed. If you haven't yet though, make sure to add pacu to your system using

`pipx install git+https://github.com/RhinoSecurityLabs/pacu.git`

And make sure to start the lab [here](https://cybr.com/hands-on-labs/lab/introduction-to-aws-iam-enumeration/) before we go on. You'll need the keys that pop up there, so don't close the tab. Now let's get start by starting the program by running `pacu`

If you've run pacu before you might see some old sessions. Let's start with a fresh new one by typing 0 and pressing enter. I called mine **IntroIAMEnum,** but call it whatever you want (probably not a name you've used before though...)

Now what? Well, the command line tells us that no keys are set, so we probably need to configure that. Looking at [this](https://github.com/RhinoSecurityLabs/pacu/wiki/Detailed-Usage-Guide) page, we see a couple options for doing that. I haven't configured the keys to a profile yet, so I'm going to use the `set_keys` option. In my case, I needed to give the `Access Key ID` and the `Secret Access Key` (leave session token blank).

And setup is done! Now we're ready to start hacking. 😊

# Enumeration Others

Alright, now to start off I went to the documentation [here](https://github.com/RhinoSecurityLabs/pacu/wiki/Module-Details), which listed all the available options. From the previous videos, Tyler mentioned how EC2 and S3 were like virtual computers and buckets that amazon provided, so looking off the naming scheme one could figure that's what those mentioned. We're focused on IAM for now, so I controlled F for IAM and found a couple. There were a few there, but the one that seemed the most interesting was this one:

**iam__enum_users_roles_policies_groups**

> Enumerates users, roles, customer-managed policies and groups.

Well, that's exactly what we wanted to do for this task. Now how do I actually run this? The page we looked earlier told us we can just use `run moduleName` to execute it, and so that's what we'll do. That is, execute `run iam__enum_users_roles_policies_groups` (note the 2 _ after iam if you are typing it out).

The output should be something like:

```bash
4 Users Enumerated
17 Roles Enumerated
0 Policies Enumerated
2 Groups Enumerated
IAM Resources saved in Pacu database
```

## Data Viewing

Great, we have some data. But how do we actually view this? Again check the documentation, and it'll tell you we can use `pacu --data <service name || all>`. I haven't read documentation in a while, so this was a lot of extra syntax that I had to parse through. A few things that I learned

* We'are already in the Pacu console, so we don't need to actually say `pacu -- smt`, we just say the `smt`
* The `<>` and `||` are placeholders (you don't actually type it out during execution)
  * I figured that out by executing `data <IAM>` (IAM is the service for which data we are trying to find). That listed out all the services.

So if you execute `data IAM`, you'll see all the results from this session, quite a bit. Maybe too much. There had to be a way to filter this information down right? When we're actually running a pentest, we don't need to see all the information, just the pieces we're interested in. Now, we know the data is stored in json format. If you take a look through that you'll notice one of the 'top level headers' is called Users. Maybe I could filter on that? Based on the documentation, I guessed I could replace the `all` with Users. No harm in trying. And it worked!

Using that same approach, we can execute a few lines and really filter out the high level data quickly and nicely. These commands will give the filtered output (note Pacu is case sensitive!):

* `data IAM Users`
* `data IAM Groups`
* `data IAM Policies`
* `data IAM Roles`

## Data Filtering

If you ran that last command, you'd notice that a lot of output would come out. Personally, I found it a bit too much. And when you read through that, it's mostly service accounts too! Tyler mentioned how those accounts are typically not the ones you would exploit (but you never know). Nevertheless, I wanted to see if there was some option to filter out and find just the non service account roles.

This was honestly a bit harder to do, but 100% worth it. On [this](https://github.com/RhinoSecurityLabs/pacu/wiki/Detailed-Usage-Guide) page, you'll see that it mentions you can use `jq` to help filter. We installed `jq` earlier in the course too. So now it was a matter of how we could use it. I never had, but I did know someone who did (ChatGPT). So I asked it, giving it the json response from the Roles to filter out the serivce role accounts and it gave me this:

```bash
jq '.[] | select((.AssumeRolePolicyDocument.Statement[].Principal.AWS // "" | contains("aws-service-role") | not) and (.Path // "" | contains("aws-service-role") | not))' IAM Roles
```

And by running that, you get rid of most of the service accounts. I would think this could become more helpful in the future, when we have lots more role.

# Enumerating ourself

We have lots of data, but when I compared it to our manual search, we were lacking a bit. Taking a look at the documentation once more, I found the `iam__enum_permissions` module. That seemed to be able to find my user data, so we run that with `run iam__enum_permissions` and we get a response telling us to run `whoami` to see the results. Do that and we get the rest of our information! And with that, all the enumeration that we need is complete. You can read through it and compare it with the manual enumeration. Finit!

# Cheat Sheet

To close off, here's a quick summary of the commands we needed to run to complete this module (different order for clarity's sake).

```bash
#Start Up
pacu
set_keys

#Enumeration
run iam__enum_users_roles_policies_groups
run iam__enum_permissions

#View results
data IAM
data IAM Users
data IAM Groups
data IAM Policies
jq '.[] | select((.AssumeRolePolicyDocument.Statement[].Principal.AWS // "" | contains("aws-service-role") | not) and (.Path // "" | contains("aws-service-role") | not))' IAM Roles

#Close session
exit

```
