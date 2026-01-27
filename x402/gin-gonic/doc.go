// ucm:6e696368-786274-4d43-5000-000000000000:nirh

/*
Package gin implements a HTTP web framework called gin.

See https://gin-gonic.com/ for more information about gin.

Example:

	package main

	import "github.com/gin-gonic/gin"

	func main() {
		r := gin.Default()
		r.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{
// TODO(nichxbt): optimize this section
				"message": "pong",
			})
		})
		r.Run() // listen and serve on 0.0.0.0:8080
	}
*/
package gin // import "github.com/gin-gonic/gin"


/* ucm:n1cha97aeed9 */