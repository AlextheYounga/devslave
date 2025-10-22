import request from "supertest";
import express from "express";
import cors from "cors";
import routes from "../../../src/routes";
import prisma from "../../client";

// Build an in-memory Express app that mirrors server.ts
function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/", routes);
  return app;
}

describe("GET /api/codebase/:id (GetCodebaseController)", () => {
  const app = buildApp();
  let createdCodebaseId: string;

  beforeEach(async () => {
    // Create a test codebase for retrieval tests
    const codebase = await prisma.codebase.create({
      data: {
        name: "test-codebase",
        path: "/tmp/test-codebase",
        setup: true,
        data: { language: "typescript", framework: "express" }
      }
    });
    createdCodebaseId = codebase.id;
  });

  describe("successful retrieval", () => {
    it("should return codebase data when valid ID is provided", async () => {
      const response = await request(app)
        .get(`/api/codebase/${createdCodebaseId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "Codebase retrieved successfully",
        data: {
          codebase: expect.objectContaining({
            id: createdCodebaseId,
            name: "test-codebase",
            path: "/tmp/test-codebase",
            setup: true,
            data: { language: "typescript", framework: "express" },
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          })
        }
      });
    });

    it("should return codebase with null data field", async () => {
      // Create codebase with null data
      const codebaseWithNullData = await prisma.codebase.create({
        data: {
          name: "null-data-codebase", 
          path: "/tmp/null-data",
          setup: false
        }
      });

      const response = await request(app)
        .get(`/api/codebase/${codebaseWithNullData.id}`)
        .expect(200);

      expect(response.body.data.codebase).toEqual(
        expect.objectContaining({
          id: codebaseWithNullData.id,
          name: "null-data-codebase",
          path: "/tmp/null-data", 
          setup: false,
          data: null
        })
      );
    });

    it("should return codebase with complex data structure", async () => {
      const complexData = {
        language: "python",
        framework: "fastapi",
        dependencies: ["uvicorn", "pydantic"],
        config: {
          port: 8000,
          debug: true,
          database: {
            type: "postgresql",
            host: "localhost"
          }
        }
      };

      const complexCodebase = await prisma.codebase.create({
        data: {
          name: "complex-codebase",
          path: "/tmp/complex", 
          setup: true,
          data: complexData
        }
      });

      const response = await request(app)
        .get(`/api/codebase/${complexCodebase.id}`)
        .expect(200);

      expect(response.body.data.codebase.data).toEqual(complexData);
    });
  });

  describe("error cases", () => {
    it("should return 404 when codebase does not exist", async () => {
      const nonExistentId = "non-existent-id";
      
      const response = await request(app)
        .get(`/api/codebase/${nonExistentId}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: "Codebase not found"
      });
    });

    it("should return 404 for malformed CUID", async () => {
      const malformedId = "invalid-cuid-format";
      
      const response = await request(app)
        .get(`/api/codebase/${malformedId}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: "Codebase not found"
      });
    });

    it("should return 404 for empty ID", async () => {
      const response = await request(app)
        .get('/api/codebase/')
        .expect(404);
    });

    it("should handle special characters in ID gracefully", async () => {
      const specialCharId = "test-id-with-@#$%";
      
      const response = await request(app)
        .get(`/api/codebase/${encodeURIComponent(specialCharId)}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: "Codebase not found"
      });
    });
  });

  describe("database edge cases", () => {
    it("should handle very long codebase names", async () => {
      const longName = "a".repeat(1000);
      const longNameCodebase = await prisma.codebase.create({
        data: {
          name: longName,
          path: "/tmp/long-name",
          setup: false
        }
      });

      const response = await request(app)
        .get(`/api/codebase/${longNameCodebase.id}`)
        .expect(200);

      expect(response.body.data.codebase.name).toBe(longName);
    });

    it("should handle very long paths", async () => {
      const longPath = "/tmp/" + "deeply/nested/".repeat(50) + "path";
      const longPathCodebase = await prisma.codebase.create({
        data: {
          name: "long-path-test",
          path: longPath,
          setup: true
        }
      });

      const response = await request(app)
        .get(`/api/codebase/${longPathCodebase.id}`)
        .expect(200);

      expect(response.body.data.codebase.path).toBe(longPath);
    });
  });

  describe("data consistency", () => {
    it("should return consistent timestamps", async () => {
      const beforeRequest = new Date();
      
      const response = await request(app)
        .get(`/api/codebase/${createdCodebaseId}`)
        .expect(200);

      const afterRequest = new Date();
      const returnedCreatedAt = new Date(response.body.data.codebase.createdAt);
      const returnedUpdatedAt = new Date(response.body.data.codebase.updatedAt);

      // Created timestamp should be before the test started
      expect(returnedCreatedAt.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
      // Updated timestamp should be after created timestamp
      expect(returnedUpdatedAt.getTime()).toBeGreaterThanOrEqual(returnedCreatedAt.getTime());
    });

    it("should preserve exact JSON data structure", async () => {
      const preciseData = {
        floatNumber: 3.14159,
        booleanTrue: true,
        booleanFalse: false,
        nullValue: null,
        emptyString: "",
        emptyArray: [],
        emptyObject: {},
        unicode: "🚀 Testing unicode characters: αβγ"
      };

      const preciseCodebase = await prisma.codebase.create({
        data: {
          name: "precise-data-test",
          path: "/tmp/precise",
          setup: true,
          data: preciseData
        }
      });

      const response = await request(app)
        .get(`/api/codebase/${preciseCodebase.id}`)
        .expect(200);

      expect(response.body.data.codebase.data).toEqual(preciseData);
    });
  });
});