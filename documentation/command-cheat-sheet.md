## Create/delete EKS cluster

`eksctl create cluster --name sas-demo --region us-east-2 --fargate`

`eksctl delete cluster --name sas-demo --region us-east-2`

## AWS eks commands

```
aws eks list-clusters
```

`aws eks update-kubeconfig --region us-east-2 --name sas-demo-cluster`

`SasDemoStack.sasdemoeksConfigCommand02A840D6 = aws eks update-kubeconfig --name sas-demo-cluster --region us-east-2 --role-arn arn:aws:iam::596605154423:role/SasDemoStack-AdminRole38563C57-G7ME2I795XGG`

`SasDemoStack.sasdemoeksGetTokenCommandCEAC2F91 = aws eks get-token --cluster-name sas-demo-cluster --region us-east-2 --role-arn arn:aws:iam::596605154423:role/SasDemoStack-AdminRole38563C57-G7ME2I795XGG`

## kubectl commands

`kubectl get services` 

`kubectl apply -f eks-sample-deployment.yaml`

`kubectl apply -f eks-sample-service.yml`

`kubectl get all`

`kubectl get services`

`kubectl get pods --all-namespaces -o wide`

[kubectl cheatsheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
