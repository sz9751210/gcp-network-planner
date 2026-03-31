package main

import (
	"context"
	"fmt"

	crm1 "google.golang.org/api/cloudresourcemanager/v1"
	crm3 "google.golang.org/api/cloudresourcemanager/v3"
)

func main() {
	ctx := context.Background()

	fmt.Println("Testing V1 List...")
	svc1, _ := crm1.NewService(ctx)
	res1, err := svc1.Projects.List().Filter("lifecycleState:ACTIVE").Do()
	if err != nil {
		fmt.Printf("V1 Error: %v\n", err)
	} else {
		fmt.Printf("V1 Success: %d projects\n", len(res1.Projects))
	}

	fmt.Println("Testing V3 Search Empty Query...")
	svc3, _ := crm3.NewService(ctx)
	res3b, err := svc3.Projects.Search().Do()
	if err != nil {
		fmt.Printf("V3 Error Empty Query: %v\n", err)
	} else {
		fmt.Printf("V3 Success Empty Query: %d projects\n", len(res3b.Projects))
	}
}
