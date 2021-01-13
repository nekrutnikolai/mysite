
# build website with hugo
hugo --gc

# add the changes to git
git add .

#ask for commit msg and store it in varname
echo What commit message u want?

read varname

#commit with the generated message
git commit -m "$varname"

#push the site
git push


