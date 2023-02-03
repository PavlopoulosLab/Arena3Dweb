#!/usr/bin/env python
from sys import argv

f=open(argv[1],"r")
f1=f.readlines()
f.close()
layers=dict()
for line in f1:
    data=line.strip().split()
    layers[data[0]]=data[1].split(",")
    
    
reformatted_name="reformatted_%s"%argv[1];
out=open(reformatted_name, "w")    


for key in layers.keys():
    for i in layers[key]:
        out.write("%s\t%s\n" %(i,key))
        
print("Reformatted file is saved as "+reformatted_name)
out.close()